/**
 * Person scraper handler with invocation-scoped resolve/session execution.
 */

import { eq } from 'drizzle-orm'
import log from 'electron-log/main'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '@shared/db'
import {
  PERSON_SCRAPER_SLOTS,
  scraperProfiles,
  type PersonScraperSlot,
  type PersonScraperSlotConfigs,
  type ScraperProfile,
  type SlotStrategy
} from '@shared/db'
import { type ProfileCleanupAction } from '@shared/scraper'
import type {
  PersonScraperProviderInfo,
  PersonSearchResult,
  ScrapedPersonBundle,
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
import { mergePersonScraperBundle, mergePersonScraperImages } from './merge'
import type {
  PersonResolvedTarget,
  PersonScraperProvider,
  PersonScraperSession,
  PersonSessionResultMap
} from './provider'
import type { PersonScraperImageResult, PersonScraperImageSlot, PersonScraperResult } from './types'
import type { SlotResult } from '../../types'

type ValidatedPersonProfile = ScraperProfile & { slotConfigs: PersonScraperSlotConfigs }

const PERSON_ALLOWED_CAPABILITIES = new Set(['search', ...PERSON_SCRAPER_SLOTS] as const)

function hasValidPersonInfoData(
  data: PersonSessionResultMap['info'],
  strategy: SlotStrategy
): boolean {
  return strategy !== 'first' || (typeof data.name === 'string' && data.name.trim().length > 0)
}

function hasValidPersonSlotData<S extends PersonScraperSlot>(
  slot: S,
  data: PersonSessionResultMap[S],
  strategy: SlotStrategy
): boolean {
  if (slot === 'info') {
    return hasValidPersonInfoData(data as PersonSessionResultMap['info'], strategy)
  }

  return Array.isArray(data) && data.length > 0
}

export class PersonScraperHandler {
  private providers = createProviderRegistry<PersonScraperProvider>(PERSON_ALLOWED_CAPABILITIES)

  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private i18n: I18nService
  ) {}

  registerProvider(provider: PersonScraperProvider): void {
    this.providers.register(provider)
    log.info(`[Scraper] Registered person provider: ${provider.id}`)
  }

  async unregisterProvider(providerId: string): Promise<Map<string, ProfileCleanupAction>> {
    this.providers.delete(providerId)
    log.info(`[Scraper] Unregistered person provider: ${providerId}`)

    const allProfiles = this.db
      .select()
      .from(scraperProfiles)
      .where(eq(scraperProfiles.mediaType, 'person'))
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

  getProviders(): PersonScraperProviderInfo[] {
    return this.providers.list().map((provider) => ({
      id: provider.id,
      name: provider.name,
      externalIdSource: provider.externalIdSource,
      capabilities: [...provider.capabilities]
    }))
  }

  getProviderInfo(providerId: string): PersonScraperProviderInfo {
    const provider = this.getSearchProvider(providerId)
    return {
      id: provider.id,
      name: provider.name,
      externalIdSource: provider.externalIdSource,
      capabilities: [...provider.capabilities]
    }
  }

  async ensureProfileValid(profileId: string): Promise<ProfileCleanupAction> {
    const profile = this.loadProfile(profileId)

    if (!hasRegisteredProvider(this.providers.asMap(), profile.searchProviderId)) {
      this.db.delete(scraperProfiles).where(eq(scraperProfiles.id, profileId)).run()
      log.info(`[Scraper] Deleted person profile '${profile.name}' (invalid searchProviderId)`)
      return 'deleted'
    }

    const { slotConfigs, changed } = sanitizeSlotConfigs(
      'person',
      profile.slotConfigs,
      this.providers.asMap()
    )
    if (changed) {
      this.db
        .update(scraperProfiles)
        .set({ slotConfigs })
        .where(eq(scraperProfiles.id, profileId))
        .run()
      log.info(`[Scraper] Updated person profile '${profile.name}' (cleaned slot providers)`)
      return 'updated'
    }

    return 'unchanged'
  }

  async search(profileId: string, query: string): Promise<PersonSearchResult[]> {
    const profile = this.loadProfile(profileId)
    const provider = this.getSearchProvider(profile.searchProviderId)
    const results = await provider.search(query, this.getProfileLocale(profile))
    return results.map((result) =>
      ensureProviderExternalId(result, provider.externalIdSource, result.id)
    )
  }

  async scrape(profileId: string, lookup: ScraperLookup): Promise<ScrapedPersonBundle | null> {
    let profile = this.loadProfile(profileId)

    const action = await this.ensureProfileValid(profileId)
    if (action === 'deleted') {
      throw new Error(`Profile '${profileId}' was invalid and has been deleted`)
    }
    if (action === 'updated') {
      profile = this.loadProfile(profileId)
    }

    const validatedProfile: ValidatedPersonProfile = {
      ...profile,
      slotConfigs: profile.slotConfigs as PersonScraperSlotConfigs
    }

    const resolveLocale = this.getResolveLocale(profile, lookup)
    const searchProvider = this.getSearchProvider(profile.searchProviderId)
    const plan = buildExecutionPlan<PersonScraperSlot>({
      slotConfigs: validatedProfile.slotConfigs,
      resolveLocale: (entry) => this.getFetchLocale(validatedProfile, entry)
    })
    const state = createScraperInvocationState<
      PersonResolvedTarget,
      PersonScraperSession,
      PersonScraperSlot,
      PersonSessionResultMap,
      PersonScraperResult
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
      ): Promise<PersonResolvedTarget | null> => {
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
          this.createPersonResult(providerId, target, entry, data),
        warn: (message, error) => log.warn(message, error)
      })) as readonly PersonScraperResult[]

      return mergePersonScraperBundle([...results], validatedProfile)
    } finally {
      await state.dispose()
    }
  }

  async getProviderImages(
    providerId: string,
    lookup: ScraperLookup,
    imageType: PersonScraperImageSlot
  ): Promise<string[]> {
    const provider = this.providers.get(providerId)
    if (!provider) {
      log.warn(`[Scraper] Person provider '${providerId}' not available`)
      return []
    }

    if (!provider.capabilities.includes(imageType)) {
      log.warn(`[Scraper] Person provider '${providerId}' does not support slot '${imageType}'`)
      return []
    }

    const locale = lookup.locale ?? (this.i18n.getLocale() as Locale)
    const plan = buildSingleProviderExecutionPlan<PersonScraperImageSlot>({
      providerId,
      slot: imageType,
      locale
    })
    const state = createScraperInvocationState<
      PersonResolvedTarget,
      PersonScraperSession,
      PersonScraperSlot,
      PersonSessionResultMap,
      PersonScraperImageResult
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
          this.createPersonResult(resolvedProviderId, target, entry, data),
        warn: (message, error) => log.warn(message, error)
      })) as readonly PersonScraperImageResult[]

      return mergePersonScraperImages([...results], 'enrich')
    } catch (error) {
      log.warn(`[Scraper] ${providerId}.${imageType} failed:`, error)
      return []
    } finally {
      await state.dispose()
    }
  }

  private createPersonResult<S extends PersonScraperSlot>(
    providerId: string,
    target: PersonResolvedTarget,
    entry: PlannedSlotEntry<S>,
    data: PersonSessionResultMap[S]
  ): SlotResult<S, PersonSessionResultMap[S]> | null {
    if (entry.slot === 'info') {
      const normalized = ensureProviderExternalId(
        data as PersonSessionResultMap['info'],
        this.requireProviderExternalIdSource(providerId),
        target.id
      )

      return hasValidPersonInfoData(normalized, entry.strategy)
        ? ({
            slot: entry.slot,
            providerId,
            rank: entry.rank,
            data: normalized
          } as SlotResult<S, PersonSessionResultMap[S]>)
        : null
    }

    if (!hasValidPersonSlotData(entry.slot, data, entry.strategy)) {
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
    if (profile.mediaType !== 'person') {
      throw new Error(`Profile '${profileId}' is not a person scraper profile`)
    }
    return profile
  }

  private getSearchProvider(providerId: string): PersonScraperProvider {
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
    return (profile.defaultLocale ?? this.i18n.getLocale()) as Locale
  }

  private getResolveLocale(profile: ScraperProfile, lookup: ScraperLookup): Locale {
    return (lookup.locale ?? profile.defaultLocale ?? this.i18n.getLocale()) as Locale
  }

  private getFetchLocale(profile: ScraperProfile, entry: { locale?: Locale | null }): Locale {
    return (entry.locale ?? profile.defaultLocale ?? this.i18n.getLocale()) as Locale
  }
}
