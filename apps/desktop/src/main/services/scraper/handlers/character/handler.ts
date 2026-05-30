/**
 * Character scraper handler with invocation-scoped resolve/session execution.
 */

import { eq } from 'drizzle-orm'
import { createLogger } from '@main/log'
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
import type { Locale } from '@shared/locale'
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
import type { SlotResult } from '../../types'

const log = createLogger('Scraper')

type RuntimeCharacterProfile = ScraperProfile & { slotConfigs: CharacterScraperSlotConfigs }

const CHARACTER_ALLOWED_CAPABILITIES = new Set(['search', ...CHARACTER_SCRAPER_SLOTS] as const)

function hasValidCharacterInfoData(
  data: CharacterSessionResultMap['info'],
  strategy: SlotStrategy
): boolean {
  return strategy !== 'first' || (typeof data.name === 'string' && data.name.trim().length > 0)
}

function hasValidCharacterSlotData<S extends CharacterScraperSlot>(
  slot: S,
  data: CharacterSessionResultMap[S],
  strategy: SlotStrategy
): boolean {
  if (slot === 'info') {
    return hasValidCharacterInfoData(data as CharacterSessionResultMap['info'], strategy)
  }

  return Array.isArray(data) && data.length > 0
}

export class CharacterScraperHandler {
  private providers = createProviderRegistry<CharacterScraperProvider>(
    CHARACTER_ALLOWED_CAPABILITIES
  )

  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private i18n: I18nService
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
    const provider = this.getSearchProvider(providerId)
    return {
      id: provider.id,
      name: provider.name,
      externalIdSource: provider.externalIdSource,
      capabilities: [...provider.capabilities]
    }
  }

  async search(profileId: string, query: string): Promise<CharacterSearchResult[]> {
    const profile = this.loadProfile(profileId)
    const provider = this.getSearchProvider(profile.searchProviderId)
    const results = await provider.search(query, this.getProfileLocale(profile))
    return results.map((result) =>
      ensureProviderExternalId(result, provider.externalIdSource, result.id)
    )
  }

  async scrape(profileId: string, lookup: ScraperLookup): Promise<ScrapedCharacterBundle | null> {
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
    const searchProvider = this.getSearchProvider(runtimeProfile.searchProviderId)
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
      const { target: searchTarget, canonicalLookup } = await resolveSearchProviderTarget({
        state,
        providerId: searchProvider.id,
        provider: searchProvider,
        lookup,
        locale: resolveLocale,
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })

      if (searchTarget) {
        state.collectIdentity(this.createTargetIdentity(searchProvider.id, searchTarget))
      }

      const resolveProviderId = async (
        providerId: string,
        locale: Locale
      ): Promise<CharacterResolvedTarget | null> => {
        void locale

        const provider = this.providers.get(providerId)
        if (!provider) {
          log.warn('Provider not available.', { providerId: providerId })
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
          locale: resolveLocale
        })
      }

      const results = (await executeScraperPlan({
        state,
        plan,
        getProvider: (providerId) => this.providers.get(providerId),
        resolveProviderTarget: resolveProviderId,
        collectResolvedIdentity: ({ providerId, target }) =>
          state.collectIdentity(this.createTargetIdentity(providerId, target)),
        buildResult: ({ providerId, target, entry, data }) =>
          this.createCharacterResult(providerId, target, entry, data),
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })) as readonly CharacterScraperResult[]

      return mergeCharacterScraperBundle(
        [...results],
        runtimeProfile,
        state.getCollectedIdentities()
      )
    } finally {
      await state.dispose()
    }
  }

  async getProviderImages(
    providerId: string,
    lookup: ScraperLookup,
    imageType: CharacterScraperImageSlot
  ): Promise<string[]> {
    const provider = this.providers.get(providerId)
    if (!provider) {
      log.warn('Character provider not available.', { providerId: providerId })
      return []
    }

    if (!provider.capabilities.includes(imageType)) {
      log.warn('Character provider does not support image slot.', {
        providerId: providerId,
        imageType: imageType
      })
      return []
    }

    const locale = lookup.locale ?? (this.i18n.locale.getCurrent() as Locale)
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
            locale
          })
        },
        buildResult: ({ providerId: resolvedProviderId, target, entry, data }) =>
          this.createCharacterResult(resolvedProviderId, target, entry, data),
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })) as readonly CharacterScraperImageResult[]

      return mergeCharacterScraperImages([...results], 'enrich')
    } catch (error) {
      log.warn('Provider request failed.', error, { providerId: providerId, imageType: imageType })
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

    if (!hasValidCharacterSlotData(entry.slot, data, entry.strategy)) {
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

  private getSearchProvider(providerId: string): CharacterScraperProvider {
    const provider = this.providers.get(providerId)
    if (!provider || !provider.capabilities.includes('search')) {
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

  private getProfileLocale(profile: ScraperProfile): Locale {
    return (profile.defaultLocale ?? this.i18n.locale.getCurrent()) as Locale
  }

  private getResolveLocale(profile: ScraperProfile, lookup: ScraperLookup): Locale {
    return (lookup.locale ?? profile.defaultLocale ?? this.i18n.locale.getCurrent()) as Locale
  }

  private getFetchLocale(profile: ScraperProfile, entry: { locale?: Locale | null }): Locale {
    return (entry.locale ?? profile.defaultLocale ?? this.i18n.locale.getCurrent()) as Locale
  }
}
