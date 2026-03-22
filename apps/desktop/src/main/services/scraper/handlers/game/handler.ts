/**
 * Game scraper handler with slot-level strategy execution.
 */

import { eq } from 'drizzle-orm'
import log from 'electron-log/main'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '@shared/db'
import {
  GAME_SCRAPER_SLOTS,
  scraperProfiles,
  type GameScraperSlot,
  type GameScraperSlotConfigs,
  type ScraperProfile,
  type ScraperProviderEntry,
  type SlotStrategy
} from '@shared/db'
import {
  type GameImageSlot,
  type ProfileCleanupAction,
  type ScraperCapability
} from '@shared/scraper'
import type {
  GameScraperProviderInfo,
  GameSearchResult,
  ScrapedGameBundle,
  ScraperLookup
} from '@shared/scraper'
import type { Locale } from '@shared/locale'
import type { I18nService } from '@main/services/i18n'
import { ensureProviderExternalId } from '../../utils'
import {
  assertProviderContract,
  createResolveCache,
  getOrderedEnabledProviderEntries,
  hasValidSlotData,
  hasRegisteredProvider,
  sanitizeSlotConfigs,
  type ResolveResult
} from '../common'
import { mergeGameScraperBundle } from './merge'
import type { GameScraperProvider } from './provider'
import type { GameScraperResult } from './types'

type ValidatedGameProfile = ScraperProfile & { slotConfigs: GameScraperSlotConfigs }

const GAME_CAPABILITY_METHODS = [
  ['search', 'search'],
  ['info', 'getInfo'],
  ['tags', 'getTags'],
  ['characters', 'getCharacters'],
  ['persons', 'getPersons'],
  ['companies', 'getCompanies'],
  ['covers', 'getCovers'],
  ['backdrops', 'getBackdrops'],
  ['logos', 'getLogos'],
  ['icons', 'getIcons']
] as const satisfies ReadonlyArray<readonly [ScraperCapability, keyof GameScraperProvider]>

const GAME_ALLOWED_CAPABILITIES = new Set<ScraperCapability>(['search', ...GAME_SCRAPER_SLOTS])

export class GameScraperHandler {
  private providers = new Map<string, GameScraperProvider>()

  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private i18n: I18nService
  ) {}

  registerProvider(provider: GameScraperProvider): void {
    assertProviderContract(provider, GAME_ALLOWED_CAPABILITIES, GAME_CAPABILITY_METHODS)
    this.providers.set(provider.id, provider)
    log.info(`[Scraper] Registered provider: ${provider.id}`)
  }

  async unregisterProvider(providerId: string): Promise<Map<string, ProfileCleanupAction>> {
    this.providers.delete(providerId)
    log.info(`[Scraper] Unregistered provider: ${providerId}`)

    const allProfiles = this.db
      .select()
      .from(scraperProfiles)
      .where(eq(scraperProfiles.mediaType, 'game'))
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

  getProviders(): GameScraperProviderInfo[] {
    return Array.from(this.providers.values()).map((provider) => ({
      id: provider.id,
      name: provider.name,
      capabilities: [...provider.capabilities]
    }))
  }

  getProviderInfo(providerId: string): GameScraperProviderInfo {
    const provider = this.getProvider(providerId)
    return {
      id: provider.id,
      name: provider.name,
      capabilities: [...provider.capabilities]
    }
  }

  async ensureProfileValid(profileId: string): Promise<ProfileCleanupAction> {
    const profile = this.loadProfile(profileId)

    if (!hasRegisteredProvider(this.providers, profile.searchProviderId)) {
      this.db.delete(scraperProfiles).where(eq(scraperProfiles.id, profileId)).run()
      log.info(`[Scraper] Deleted profile '${profile.name}' (invalid searchProviderId)`)
      return 'deleted'
    }

    const { slotConfigs, changed } = sanitizeSlotConfigs(
      'game',
      profile.slotConfigs,
      this.providers
    )
    if (changed) {
      this.db
        .update(scraperProfiles)
        .set({ slotConfigs })
        .where(eq(scraperProfiles.id, profileId))
        .run()
      log.info(`[Scraper] Updated profile '${profile.name}' (cleaned slot providers)`)
      return 'updated'
    }

    return 'unchanged'
  }

  async search(profileId: string, query: string): Promise<GameSearchResult[]> {
    const profile = this.loadProfile(profileId)
    const provider = this.getProvider(profile.searchProviderId)
    const results = await provider.search(query, this.getProfileLocale(profile))
    return results.map((result) => ensureProviderExternalId(result, provider.id, result.id))
  }

  async scrape(profileId: string, lookup: ScraperLookup): Promise<ScrapedGameBundle | null> {
    let profile = this.loadProfile(profileId)

    const action = await this.ensureProfileValid(profileId)
    if (action === 'deleted') {
      throw new Error(`Profile '${profileId}' was invalid and has been deleted`)
    }
    if (action === 'updated') {
      profile = this.loadProfile(profileId)
    }

    const validatedProfile: ValidatedGameProfile = {
      ...profile,
      slotConfigs: profile.slotConfigs as GameScraperSlotConfigs
    }

    const resolveLocale = this.getResolveLocale(profile, lookup)
    const resolveViaCache = createResolveCache<GameSearchResult>(this.providers)

    const searchResult = await resolveViaCache(
      profile.searchProviderId,
      lookup.name,
      lookup.knownIds,
      resolveLocale
    )

    let resolveName = lookup.name
    if (searchResult?.originalName) {
      resolveName = searchResult.originalName
      log.info(`[Scraper] Using originalName '${resolveName}' for cross-provider search`)
    }

    const resolvedProviders = new Map<string, Promise<ResolveResult | null>>()
    if (searchResult) {
      resolvedProviders.set(profile.searchProviderId, Promise.resolve(searchResult))
    }

    const resolveProviderId = (providerId: string): Promise<ResolveResult | null> => {
      const existing = resolvedProviders.get(providerId)
      if (existing) {
        return existing
      }

      const task = resolveViaCache(providerId, resolveName, lookup.knownIds, resolveLocale)
      resolvedProviders.set(providerId, task)
      return task
    }

    const slotResults = await Promise.all(
      GAME_SCRAPER_SLOTS.map((slot) => this.executeSlot(validatedProfile, slot, resolveProviderId))
    )

    return mergeGameScraperBundle(slotResults.flat(), validatedProfile)
  }

  async getProviderImages(
    providerId: string,
    lookup: ScraperLookup,
    imageType: GameImageSlot
  ): Promise<string[]> {
    const provider = this.providers.get(providerId)
    if (!provider) {
      log.warn(`[Scraper] Provider '${providerId}' not available`)
      return []
    }

    if (!provider.capabilities.includes(imageType)) {
      log.warn(`[Scraper] Provider '${providerId}' does not support image slot '${imageType}'`)
      return []
    }

    const locale = lookup.locale ?? (this.i18n.getLocale() as Locale)
    const resolveId = createResolveCache<GameSearchResult>(this.providers)
    const result = await resolveId(providerId, lookup.name, lookup.knownIds, locale)

    if (!result) {
      log.warn(`[Scraper] Could not resolve ID for '${lookup.name}' via ${providerId}`)
      return []
    }

    try {
      switch (imageType) {
        case 'covers': {
          const data = await provider.getCovers!(result.id, locale)
          return Array.isArray(data) ? data : []
        }
        case 'backdrops': {
          const data = await provider.getBackdrops!(result.id, locale)
          return Array.isArray(data) ? data : []
        }
        case 'logos': {
          const data = await provider.getLogos!(result.id, locale)
          return Array.isArray(data) ? data : []
        }
        case 'icons': {
          const data = await provider.getIcons!(result.id, locale)
          return Array.isArray(data) ? data : []
        }
      }
    } catch (error) {
      log.warn(`[Scraper] ${providerId}.${imageType} failed:`, error)
      return []
    }
  }

  private async executeSlot(
    profile: ValidatedGameProfile,
    slot: GameScraperSlot,
    resolveProviderId: (providerId: string) => Promise<ResolveResult | null>
  ): Promise<GameScraperResult[]> {
    const config = profile.slotConfigs[slot]
    const entries = getOrderedEnabledProviderEntries(config.providers)

    if (config.strategy === 'first') {
      for (const entry of entries) {
        const resolved = await resolveProviderId(entry.providerId)
        if (!resolved) continue

        const result = await this.fetchSlot(
          entry.providerId,
          resolved.id,
          this.getFetchLocale(profile, entry),
          slot,
          entry.priority,
          config.strategy
        )

        if (result) {
          return [result]
        }
      }

      return []
    }

    const results = await Promise.all(
      entries.map(async (entry) => {
        const resolved = await resolveProviderId(entry.providerId)
        if (!resolved) return null

        return this.fetchSlot(
          entry.providerId,
          resolved.id,
          this.getFetchLocale(profile, entry),
          slot,
          entry.priority,
          config.strategy
        )
      })
    )

    return results.filter((result): result is GameScraperResult => result !== null)
  }

  private async fetchSlot(
    providerId: string,
    id: string,
    locale: Locale,
    slot: GameScraperSlot,
    priority: number,
    strategy: SlotStrategy
  ): Promise<GameScraperResult | null> {
    const provider = this.providers.get(providerId)
    if (!provider) {
      log.warn(`[Scraper] Provider '${providerId}' not available`)
      return null
    }

    if (!provider.capabilities.includes(slot)) {
      log.warn(`[Scraper] Provider '${providerId}' does not support slot '${slot}'`)
      return null
    }

    try {
      switch (slot) {
        case 'info': {
          const data = ensureProviderExternalId(await provider.getInfo!(id, locale), providerId, id)
          return hasValidSlotData(slot, data, strategy) ? { slot, priority, data } : null
        }
        case 'tags': {
          const data = await provider.getTags!(id, locale)
          return hasValidSlotData(slot, data, strategy) ? { slot, priority, data } : null
        }
        case 'characters': {
          const data = await provider.getCharacters!(id, locale)
          return hasValidSlotData(slot, data, strategy) ? { slot, priority, data } : null
        }
        case 'persons': {
          const data = await provider.getPersons!(id, locale)
          return hasValidSlotData(slot, data, strategy) ? { slot, priority, data } : null
        }
        case 'companies': {
          const data = await provider.getCompanies!(id, locale)
          return hasValidSlotData(slot, data, strategy) ? { slot, priority, data } : null
        }
        case 'covers': {
          const data = await provider.getCovers!(id, locale)
          return hasValidSlotData(slot, data, strategy) ? { slot, priority, data } : null
        }
        case 'backdrops': {
          const data = await provider.getBackdrops!(id, locale)
          return hasValidSlotData(slot, data, strategy) ? { slot, priority, data } : null
        }
        case 'logos': {
          const data = await provider.getLogos!(id, locale)
          return hasValidSlotData(slot, data, strategy) ? { slot, priority, data } : null
        }
        case 'icons': {
          const data = await provider.getIcons!(id, locale)
          return hasValidSlotData(slot, data, strategy) ? { slot, priority, data } : null
        }
      }
    } catch (error) {
      log.warn(`[Scraper] ${providerId}.${slot} failed:`, error)
      return null
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
    if (profile.mediaType !== 'game') {
      throw new Error(`Profile '${profileId}' is not a game scraper profile`)
    }
    return profile
  }

  private getProvider(providerId: string): GameScraperProvider {
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

  private getFetchLocale(profile: ScraperProfile, entry: ScraperProviderEntry): Locale {
    return (entry.locale ?? profile.defaultLocale ?? this.i18n.getLocale()) as Locale
  }
}
