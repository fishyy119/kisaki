/**
 * Game scraper handler with invocation-scoped resolve/session execution.
 */

import { eq } from 'drizzle-orm'
import { createLogger } from '@main/log'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '@shared/db/schema'
import { scraperProfiles, type ScraperProfile } from '@shared/db/schema'
import { GAME_SCRAPER_SLOTS } from '@shared/db/contracts/constants'
import type {
  GameScraperSlot,
  GameScraperSlotConfigs,
  SlotStrategy
} from '@shared/db/contracts/json'
import { type GameImageSlot } from '@shared/scraper'
import type {
  GameScraperProviderInfo,
  GameSearchResult,
  ScrapedGameBundle,
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
import { mergeGameScraperBundle, mergeGameScraperImages } from './merge'
import type {
  GameResolvedTarget,
  GameScraperProvider,
  GameScraperSession,
  GameSessionResultMap
} from './provider'
import type { GameScraperImageResult, GameScraperResult } from './types'
import type { SlotResult } from '../../types'

const log = createLogger('Scraper')

type RuntimeGameProfile = ScraperProfile & { slotConfigs: GameScraperSlotConfigs }

const GAME_ALLOWED_CAPABILITIES = new Set(['search', ...GAME_SCRAPER_SLOTS] as const)

function hasValidGameInfoData(data: GameSessionResultMap['info'], strategy: SlotStrategy): boolean {
  return strategy !== 'first' || (typeof data.name === 'string' && data.name.trim().length > 0)
}

function hasValidGameSlotData<S extends GameScraperSlot>(
  slot: S,
  data: GameSessionResultMap[S],
  strategy: SlotStrategy
): boolean {
  if (slot === 'info') {
    return hasValidGameInfoData(data as GameSessionResultMap['info'], strategy)
  }

  return Array.isArray(data) && data.length > 0
}

export class GameScraperHandler {
  private providers = createProviderRegistry<GameScraperProvider>(GAME_ALLOWED_CAPABILITIES)

  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private i18n: I18nService
  ) {}

  registerProvider(provider: GameScraperProvider): void {
    this.providers.register(provider)
    log.info('Registered provider.', { providerId: provider.id })
  }

  unregisterProvider(providerId: string): void {
    this.providers.delete(providerId)
    log.info('Unregistered provider.', { providerId: providerId })
  }

  getProviders(): GameScraperProviderInfo[] {
    return this.providers.list().map((provider) => ({
      id: provider.id,
      name: provider.name,
      externalIdSource: provider.externalIdSource,
      capabilities: [...provider.capabilities]
    }))
  }

  getProviderInfo(providerId: string): GameScraperProviderInfo {
    const provider = this.getSearchProvider(providerId)
    return {
      id: provider.id,
      name: provider.name,
      externalIdSource: provider.externalIdSource,
      capabilities: [...provider.capabilities]
    }
  }

  async search(profileId: string, query: string): Promise<GameSearchResult[]> {
    const profile = this.loadProfile(profileId)
    const provider = this.getSearchProvider(profile.searchProviderId)
    const results = await provider.search(query, this.getProfileLocale(profile))
    return results.map((result) =>
      ensureProviderExternalId(result, provider.externalIdSource, result.id)
    )
  }

  async scrape(profileId: string, lookup: ScraperLookup): Promise<ScrapedGameBundle | null> {
    const profile = this.loadProfile(profileId)

    const runtimeProfile: RuntimeGameProfile = {
      ...profile,
      slotConfigs: prepareRuntimeSlotConfigs('game', profile.slotConfigs, this.providers.asMap())
    }

    const resolveLocale = this.getResolveLocale(runtimeProfile, lookup)
    const searchProvider = this.getSearchProvider(runtimeProfile.searchProviderId)
    const plan = buildExecutionPlan<GameScraperSlot>({
      slotConfigs: runtimeProfile.slotConfigs,
      resolveLocale: (entry) => this.getFetchLocale(runtimeProfile, entry)
    })
    const state = createScraperInvocationState<
      GameResolvedTarget,
      GameScraperSession,
      GameScraperSlot,
      GameSessionResultMap,
      GameScraperResult
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
      ): Promise<GameResolvedTarget | null> => {
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
          this.createGameResult(providerId, target, entry, data),
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })) as readonly GameScraperResult[]

      return mergeGameScraperBundle([...results], runtimeProfile, state.getCollectedIdentities())
    } finally {
      await state.dispose()
    }
  }

  async getProviderImages(
    providerId: string,
    lookup: ScraperLookup,
    imageType: GameImageSlot
  ): Promise<string[]> {
    const provider = this.providers.get(providerId)
    if (!provider) {
      log.warn('Provider not available.', { providerId: providerId })
      return []
    }

    if (!provider.capabilities.includes(imageType)) {
      log.warn('Provider does not support image slot.', {
        providerId: providerId,
        imageType: imageType
      })
      return []
    }

    const locale = lookup.locale ?? (this.i18n.locale.getCurrent() as Locale)
    const plan = buildSingleProviderExecutionPlan<GameImageSlot>({
      providerId,
      slot: imageType,
      locale
    })
    const state = createScraperInvocationState<
      GameResolvedTarget,
      GameScraperSession,
      GameScraperSlot,
      GameSessionResultMap,
      GameScraperImageResult
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
          this.createGameResult(resolvedProviderId, target, entry, data),
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })) as readonly GameScraperImageResult[]

      return mergeGameScraperImages([...results], 'enrich')
    } catch (error) {
      log.warn('Provider request failed.', error, { providerId: providerId, imageType: imageType })
      return []
    } finally {
      await state.dispose()
    }
  }

  private createGameResult<S extends GameScraperSlot>(
    providerId: string,
    target: GameResolvedTarget,
    entry: PlannedSlotEntry<S>,
    data: GameSessionResultMap[S]
  ): SlotResult<S, GameSessionResultMap[S]> | null {
    void target

    if (entry.slot === 'info') {
      const normalized = data as GameSessionResultMap['info']

      return hasValidGameInfoData(normalized, entry.strategy)
        ? ({
            slot: entry.slot,
            providerId,
            rank: entry.rank,
            data: normalized
          } as SlotResult<S, GameSessionResultMap[S]>)
        : null
    }

    if (!hasValidGameSlotData(entry.slot, data, entry.strategy)) {
      return null
    }

    return {
      slot: entry.slot,
      providerId,
      rank: entry.rank,
      data
    }
  }

  private createTargetIdentity(providerId: string, target: GameResolvedTarget) {
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
    if (profile.mediaType !== 'game') {
      throw new Error(`Profile '${profileId}' is not a game scraper profile`)
    }
    return profile
  }

  private getSearchProvider(providerId: string): GameScraperProvider {
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
