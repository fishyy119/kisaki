/**
 * Character scraper handler with invocation-scoped resolve/session execution.
 */

import { eq } from 'drizzle-orm'
import { createLogger } from '@main/log'
import { isAbortError } from '@main/utils/async'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '@shared/db/schema'
import { scraperProfiles, type ScraperProfile } from '@shared/db/schema'
import { CHARACTER_SCRAPER_SLOTS } from '@shared/db/contracts/constants'
import type {
  CharacterScraperSlot,
  CharacterScraperSlotConfigs,
  SlotStrategy
} from '@shared/db/contracts/json'
import type {
  CharacterScraperProviderInfo,
  CharacterSearchResult,
  ScrapedCharacterBundle,
  ScraperLookup
} from '@shared/scraper'
import type { ContentLocale } from '@shared/i18n'
import type { I18nService } from '@main/services/i18n'
import { ensureProviderExternalId, ensureProviderIdentity } from '../../shared'
import { executeScraperPlan } from '../common/executor'
import {
  buildExecutionPlan,
  buildSingleProviderExecutionPlan,
  prepareRuntimeSlotConfigs,
  type PlannedSlotEntry
} from '../common/planner'
import { createProviderRegistry } from '../common/registry'
import { resolveProviderTarget, resolveSearchProviderTarget } from '../common/resolve'
import { createScraperInvocationState } from '../common/state'
import { mergeCharacterScraperBundle, mergeCharacterScraperImages } from './merge'
import type {
  CharacterResolvedTarget,
  CharacterScraperProvider,
  CharacterScraperSession,
  CharacterSessionResultMap
} from './provider'
import type {
  CharacterScraperImageResult,
  CharacterScraperImageSlot,
  CharacterScraperResult
} from './types'
import type { ScraperMediaHooks } from '../../hooks'
import type { ScraperInvocationOptions, SlotResult } from '../../types'

const log = createLogger('Scraper')

type RuntimeCharacterProfile = ScraperProfile & { slotConfigs: CharacterScraperSlotConfigs }

const CHARACTER_ALLOWED_CAPABILITIES = new Set(['search', ...CHARACTER_SCRAPER_SLOTS] as const)

function hasValidCharacterInfoData(
  data: CharacterSessionResultMap['info'],
  strategy: SlotStrategy
): boolean {
  return strategy !== 'first' || (typeof data.name === 'string' && data.name.trim().length > 0)
}

export class CharacterScraperHandler {
  private providers = createProviderRegistry<CharacterScraperProvider>(
    CHARACTER_ALLOWED_CAPABILITIES
  )

  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private i18n: I18nService,
    private hooks: ScraperMediaHooks<CharacterSearchResult, ScrapedCharacterBundle>
  ) {}

  registerProvider(provider: CharacterScraperProvider): void {
    this.providers.register(provider)
    log.info('Registered character provider.', { providerId: provider.id })
  }

  unregisterProvider(providerId: string): void {
    this.providers.delete(providerId)
    log.info('Unregistered character provider.', { providerId: providerId })
  }

  getProviders(): CharacterScraperProviderInfo[] {
    return this.providers.list().map((provider) => ({
      id: provider.id,
      name: provider.name,
      externalIdSource: provider.externalIdSource,
      capabilities: [...provider.capabilities]
    }))
  }

  getProviderInfo(providerId: string): CharacterScraperProviderInfo {
    const provider = this.requireProvider(providerId)
    return {
      id: provider.id,
      name: provider.name,
      externalIdSource: provider.externalIdSource,
      capabilities: [...provider.capabilities]
    }
  }

  async search(
    profileId: string,
    query: string,
    options: ScraperInvocationOptions = {}
  ): Promise<CharacterSearchResult[]> {
    const profile = this.loadProfile(profileId)
    const provider = this.requireProvider(profile.searchProviderId)
    const results = await provider.search(query, {
      locale: this.getProfileLocale(profile),
      signal: options.signal
    })
    return this.hooks.searched.transform(
      results.map((result) =>
        ensureProviderExternalId(result, provider.externalIdSource, result.id)
      )
    )
  }

  async scrape(
    profileId: string,
    rawLookup: ScraperLookup,
    options: ScraperInvocationOptions = {}
  ): Promise<ScrapedCharacterBundle | null> {
    const lookup = await this.hooks.lookup.transform(rawLookup)
    const profile = this.loadProfile(profileId)

    const runtimeProfile: RuntimeCharacterProfile = {
      ...profile,
      slotConfigs: prepareRuntimeSlotConfigs(
        'character',
        profile.slotConfigs,
        this.providers.asMap()
      )
    }

    const resolveLocale = this.getResolveLocale(runtimeProfile, lookup)
    const searchProvider = this.requireProvider(runtimeProfile.searchProviderId)
    const plan = buildExecutionPlan<CharacterScraperSlot>({
      slotConfigs: runtimeProfile.slotConfigs,
      resolveLocale: (entry) => this.getFetchLocale(runtimeProfile, entry)
    })
    const state = createScraperInvocationState<
      CharacterResolvedTarget,
      CharacterScraperSession,
      CharacterScraperSlot,
      CharacterSessionResultMap,
      CharacterScraperResult
    >()

    try {
      const resolveCtx = { locale: resolveLocale, signal: options.signal }
      const { target: searchTarget, canonicalLookup } = await resolveSearchProviderTarget({
        state,
        providerId: searchProvider.id,
        provider: searchProvider,
        lookup,
        ctx: resolveCtx,
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })

      if (searchTarget) {
        state.collectIdentity(this.createTargetIdentity(searchProvider.id, searchTarget))
      }

      const resolveProviderId = async (
        providerId: string,
        locale: ContentLocale
      ): Promise<CharacterResolvedTarget | null> => {
        void locale

        const provider = this.providers.get(providerId)
        if (!provider) {
          log.warn('Provider not available.', { mediaType: 'character', providerId: providerId })
          return null
        }

        if (providerId === searchProvider.id && searchTarget) {
          return searchTarget
        }

        return resolveProviderTarget({
          state,
          providerId,
          provider,
          lookup: canonicalLookup,
          ctx: resolveCtx
        })
      }

      const results = (await executeScraperPlan({
        state,
        plan,
        signal: options.signal,
        getProvider: (providerId) => this.providers.get(providerId),
        resolveProviderTarget: resolveProviderId,
        collectResolvedIdentity: ({ providerId, target }) =>
          state.collectIdentity(this.createTargetIdentity(providerId, target)),
        buildResult: ({ providerId, target, entry, data }) =>
          this.createCharacterResult(providerId, target, entry, data),
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })) as readonly CharacterScraperResult[]

      const bundle = mergeCharacterScraperBundle(
        [...results],
        runtimeProfile,
        state.getCollectedIdentities()
      )
      return bundle ? this.hooks.collected.transform(bundle) : null
    } finally {
      await state.dispose()
    }
  }

  async getProviderImages(
    providerId: string,
    lookup: ScraperLookup,
    imageType: CharacterScraperImageSlot,
    options: ScraperInvocationOptions = {}
  ): Promise<string[]> {
    const provider = this.providers.get(providerId)
    if (!provider) {
      log.warn('Provider not available.', { mediaType: 'character', providerId: providerId })
      return []
    }

    if (!provider.capabilities.includes(imageType)) {
      log.warn('Provider does not support image slot.', {
        mediaType: 'character',
        providerId: providerId,
        imageType: imageType
      })
      return []
    }

    const locale = lookup.locale ?? this.i18n.locale
    const plan = buildSingleProviderExecutionPlan<CharacterScraperImageSlot>({
      providerId,
      slot: imageType,
      locale
    })
    const state = createScraperInvocationState<
      CharacterResolvedTarget,
      CharacterScraperSession,
      CharacterScraperSlot,
      CharacterSessionResultMap,
      CharacterScraperImageResult
    >()

    try {
      const results = (await executeScraperPlan({
        state,
        plan,
        signal: options.signal,
        getProvider: (candidateProviderId) => this.providers.get(candidateProviderId),
        resolveProviderTarget: async (candidateProviderId) => {
          if (candidateProviderId !== providerId) {
            return null
          }

          return resolveProviderTarget({
            state,
            providerId,
            provider,
            lookup,
            ctx: { locale, signal: options.signal }
          })
        },
        buildResult: ({ providerId: resolvedProviderId, target, entry, data }) =>
          this.createCharacterResult(resolvedProviderId, target, entry, data),
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })) as readonly CharacterScraperImageResult[]

      return mergeCharacterScraperImages([...results], 'enrich')
    } catch (error) {
      if (isAbortError(error)) {
        throw error
      }

      log.warn('Provider request failed.', error, {
        mediaType: 'character',
        providerId: providerId,
        imageType: imageType
      })
      return []
    } finally {
      await state.dispose()
    }
  }

  private createCharacterResult<S extends CharacterScraperSlot>(
    providerId: string,
    target: CharacterResolvedTarget,
    entry: PlannedSlotEntry<S>,
    data: CharacterSessionResultMap[S]
  ): SlotResult<S, CharacterSessionResultMap[S]> | null {
    void target

    if (entry.slot === 'info') {
      const normalized = data as CharacterSessionResultMap['info']

      return hasValidCharacterInfoData(normalized, entry.strategy)
        ? ({
            slot: entry.slot,
            providerId,
            rank: entry.rank,
            data: normalized
          } as SlotResult<S, CharacterSessionResultMap[S]>)
        : null
    }

    // A collection slot the provider answered is authoritative, so an empty
    // array is kept as an authoritative empty instead of a missing answer.
    if (!Array.isArray(data)) {
      return null
    }

    return {
      slot: entry.slot,
      providerId,
      rank: entry.rank,
      data
    }
  }

  private createTargetIdentity(providerId: string, target: CharacterResolvedTarget) {
    return ensureProviderIdentity(
      target.identity,
      this.requireProviderExternalIdSource(providerId),
      target.id
    )
  }

  private loadProfile(profileId: string): ScraperProfile {
    const rows = this.db
      .select()
      .from(scraperProfiles)
      .where(eq(scraperProfiles.id, profileId))
      .limit(1)
      .all()

    const profile = rows[0]
    if (!profile) throw new Error(`Profile not found: ${profileId}`)
    if (profile.mediaType !== 'character') {
      throw new Error(`Profile '${profileId}' is not a character scraper profile`)
    }
    return profile
  }

  private requireProvider(providerId: string): CharacterScraperProvider {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`)
    }
    return provider
  }

  private requireProviderExternalIdSource(providerId: string): string {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`)
    }

    return provider.externalIdSource
  }

  private getProfileLocale(profile: ScraperProfile): ContentLocale {
    return profile.defaultLocale ?? this.i18n.locale
  }

  private getResolveLocale(profile: ScraperProfile, lookup: ScraperLookup): ContentLocale {
    return lookup.locale ?? profile.defaultLocale ?? this.i18n.locale
  }

  private getFetchLocale(
    profile: ScraperProfile,
    entry: { locale?: ContentLocale | null }
  ): ContentLocale {
    return entry.locale ?? profile.defaultLocale ?? this.i18n.locale
  }
}
