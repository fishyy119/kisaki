/**
 * Character scraper handler with invocation-scoped resolve/session execution.
 */

import { eq } from 'drizzle-orm'
import log from 'electron-log/main'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '@shared/db'
import {
  CHARACTER_SCRAPER_SLOTS,
  scraperProfiles,
  type CharacterScraperSlot,
  type CharacterScraperSlotConfigs,
  type ScraperProfile,
  type SlotStrategy
} from '@shared/db'
import { type ProfileCleanupAction } from '@shared/scraper'
import type {
  CharacterScraperProviderInfo,
  CharacterSearchResult,
  ScrapedCharacterBundle,
  ScraperLookup
} from '@shared/scraper'
import type { Locale } from '@shared/locale'
import type { I18nService } from '@main/services/i18n'
import { ensureProviderExternalId } from '../../utils'
import { executeScraperPlan } from '../common/executor'
import {
  buildExecutionPlan,
  buildSingleProviderExecutionPlan,
  sanitizeSlotConfigs,
  type PlannedSlotEntry
} from '../common/planner'
import { createProviderRegistry, hasRegisteredProvider } from '../common/registry'
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

type ValidatedCharacterProfile = ScraperProfile & { slotConfigs: CharacterScraperSlotConfigs }

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
    log.info(`[Scraper] Registered character provider: ${provider.id}`)
  }

  async unregisterProvider(providerId: string): Promise<Map<string, ProfileCleanupAction>> {
    this.providers.delete(providerId)
    log.info(`[Scraper] Unregistered character provider: ${providerId}`)

    const allProfiles = this.db
      .select()
      .from(scraperProfiles)
      .where(eq(scraperProfiles.mediaType, 'character'))
      .all()

    const results = new Map<string, ProfileCleanupAction>()
    for (const profile of allProfiles) {
      const action = await this.ensureProfileValid(profile.id)
      if (action !== 'unchanged') {
        results.set(profile.id, action)
      }
    }

    return results
  }

  getProviders(): CharacterScraperProviderInfo[] {
    return this.providers.list().map((provider) => ({
      id: provider.id,
      name: provider.name,
      capabilities: [...provider.capabilities]
    }))
  }

  getProviderInfo(providerId: string): CharacterScraperProviderInfo {
    const provider = this.getSearchProvider(providerId)
    return {
      id: provider.id,
      name: provider.name,
      capabilities: [...provider.capabilities]
    }
  }

  async ensureProfileValid(profileId: string): Promise<ProfileCleanupAction> {
    const profile = this.loadProfile(profileId)

    if (!hasRegisteredProvider(this.providers.asMap(), profile.searchProviderId)) {
      this.db.delete(scraperProfiles).where(eq(scraperProfiles.id, profileId)).run()
      log.info(`[Scraper] Deleted character profile '${profile.name}' (invalid searchProviderId)`)
      return 'deleted'
    }

    const { slotConfigs, changed } = sanitizeSlotConfigs(
      'character',
      profile.slotConfigs,
      this.providers.asMap()
    )
    if (changed) {
      this.db
        .update(scraperProfiles)
        .set({ slotConfigs })
        .where(eq(scraperProfiles.id, profileId))
        .run()
      log.info(`[Scraper] Updated character profile '${profile.name}' (cleaned slot providers)`)
      return 'updated'
    }

    return 'unchanged'
  }

  async search(profileId: string, query: string): Promise<CharacterSearchResult[]> {
    const profile = this.loadProfile(profileId)
    const provider = this.getSearchProvider(profile.searchProviderId)
    const results = await provider.search(query, this.getProfileLocale(profile))
    return results.map((result) => ensureProviderExternalId(result, provider.id, result.id))
  }

  async scrape(profileId: string, lookup: ScraperLookup): Promise<ScrapedCharacterBundle | null> {
    let profile = this.loadProfile(profileId)

    const action = await this.ensureProfileValid(profileId)
    if (action === 'deleted') {
      throw new Error(`Profile '${profileId}' was invalid and has been deleted`)
    }
    if (action === 'updated') {
      profile = this.loadProfile(profileId)
    }

    const validatedProfile: ValidatedCharacterProfile = {
      ...profile,
      slotConfigs: profile.slotConfigs as CharacterScraperSlotConfigs
    }

    const resolveLocale = this.getResolveLocale(profile, lookup)
    const searchProvider = this.getSearchProvider(profile.searchProviderId)
    const plan = buildExecutionPlan<CharacterScraperSlot>({
      slotConfigs: validatedProfile.slotConfigs,
      resolveLocale: (entry) => this.getFetchLocale(validatedProfile, entry)
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
        warn: (message, error) => log.warn(message, error)
      })

      const resolveProviderId = async (
        providerId: string,
        locale: Locale
      ): Promise<CharacterResolvedTarget | null> => {
        void locale

        const provider = this.providers.get(providerId)
        if (!provider) {
          log.warn(`[Scraper] Provider '${providerId}' not available`)
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
        buildResult: ({ providerId, target, entry, data }) =>
          this.createCharacterResult(providerId, target, entry, data),
        warn: (message, error) => log.warn(message, error)
      })) as readonly CharacterScraperResult[]

      return mergeCharacterScraperBundle([...results], validatedProfile)
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
      log.warn(`[Scraper] Character provider '${providerId}' not available`)
      return []
    }

    if (!provider.capabilities.includes(imageType)) {
      log.warn(`[Scraper] Character provider '${providerId}' does not support slot '${imageType}'`)
      return []
    }

    const locale = lookup.locale ?? (this.i18n.getLocale() as Locale)
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
        warn: (message, error) => log.warn(message, error)
      })) as readonly CharacterScraperImageResult[]

      return mergeCharacterScraperImages([...results], 'enrich')
    } catch (error) {
      log.warn(`[Scraper] ${providerId}.${imageType} failed:`, error)
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
    if (entry.slot === 'info') {
      const normalized = ensureProviderExternalId(
        data as CharacterSessionResultMap['info'],
        providerId,
        target.id
      )

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

  private getProfileLocale(profile: ScraperProfile): Locale {
    return (profile.defaultLocale ?? this.i18n.getLocale()) as Locale
  }

  private getResolveLocale(profile: ScraperProfile, lookup: ScraperLookup): Locale {
    return (lookup.locale ?? profile.defaultLocale ?? this.i18n.getLocale()) as Locale
  }

  private getFetchLocale(profile: ScraperProfile, entry: { locale?: Locale | null }): Locale {
    return (entry.locale ?? profile.defaultLocale ?? this.i18n.getLocale()) as Locale
  }
}
