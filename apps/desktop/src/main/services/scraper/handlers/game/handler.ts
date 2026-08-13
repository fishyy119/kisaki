/**
 * Game scraper handler with invocation-scoped resolve/session execution.
 */

import { eq } from 'drizzle-orm'
import { createLogger } from '@main/log'
import { isAbortError } from '@main/utils/async'
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
import type { I18nService } from '@main/services/i18n'
import { ensureProviderExternalId, ensureProviderIdentity, ScrapeFailure } from '../../shared'
import { executeScraperPlan } from '../common/executor'
import {
  buildExecutionPlan,
  buildSingleProviderExecutionPlan,
  prepareRuntimeSlotConfigs,
  type PlannedSlotEntry
} from '../common/planner'
import { resolveContentLocale } from '../common/locale'
import { createProviderRegistry, toProviderInfo } from '../common/registry'
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
import type { ScraperMediaHooks } from '../../hooks'
import type { ScraperInvocationOptions, SlotResult } from '../../types'

const log = createLogger('Scraper')

type RuntimeGameProfile = ScraperProfile & { slotConfigs: GameScraperSlotConfigs }

const GAME_ALLOWED_CAPABILITIES = new Set(['search', ...GAME_SCRAPER_SLOTS] as const)

function hasValidGameInfoData(data: GameSessionResultMap['info'], strategy: SlotStrategy): boolean {
  return strategy !== 'first' || (typeof data.name === 'string' && data.name.trim().length > 0)
}

export class GameScraperHandler {
  private providers = createProviderRegistry<GameScraperProvider>(GAME_ALLOWED_CAPABILITIES)

  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private i18n: I18nService,
    private hooks: ScraperMediaHooks<GameSearchResult, ScrapedGameBundle>
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
    return this.providers.list().map(toProviderInfo)
  }

  getProviderInfo(providerId: string): GameScraperProviderInfo {
    return toProviderInfo(this.requireProvider(providerId))
  }

  async search(
    profileId: string,
    query: string,
    options: ScraperInvocationOptions = {}
  ): Promise<GameSearchResult[]> {
    const profile = this.loadProfile(profileId)
    const provider = this.requireProvider(profile.searchProviderId)
    const results = await provider.search(query, {
      locale: resolveContentLocale(undefined, profile, this.i18n.locale),
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
  ): Promise<ScrapedGameBundle | null> {
    const lookup = await this.hooks.lookup.transform(rawLookup)
    const profile = this.loadProfile(profileId)

    const runtimeProfile: RuntimeGameProfile = {
      ...profile,
      slotConfigs: prepareRuntimeSlotConfigs('game', profile.slotConfigs, this.providers.asMap())
    }

    const resolveLocale = resolveContentLocale(lookup.locale, runtimeProfile, this.i18n.locale)
    const searchProvider = this.requireProvider(runtimeProfile.searchProviderId)
    const plan = buildExecutionPlan<GameScraperSlot>({
      slotConfigs: runtimeProfile.slotConfigs,
      resolveLocale: (entry) => resolveContentLocale(entry.locale, runtimeProfile, this.i18n.locale)
    })
    const state = createScraperInvocationState<
      GameResolvedTarget,
      GameScraperSession,
      GameScraperSlot,
      GameSessionResultMap,
      GameScraperResult
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

      const resolveProviderId = async (providerId: string): Promise<GameResolvedTarget | null> => {
        const provider = this.providers.get(providerId)
        if (!provider) {
          log.warn('Provider not available.', { mediaType: 'game', providerId: providerId })
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
        buildResult: ({ providerId, entry, data }) =>
          this.createGameResult(providerId, entry, data),
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })) as readonly GameScraperResult[]

      const bundle = mergeGameScraperBundle(
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
    imageType: GameImageSlot,
    options: ScraperInvocationOptions = {}
  ): Promise<string[]> {
    const provider = this.providers.get(providerId)
    if (!provider) {
      log.warn('Provider not available.', { mediaType: 'game', providerId: providerId })
      return []
    }

    if (!provider.capabilities.includes(imageType)) {
      log.warn('Provider does not support image slot.', {
        mediaType: 'game',
        providerId: providerId,
        imageType: imageType
      })
      return []
    }

    const locale = lookup.locale ?? this.i18n.locale
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
        buildResult: ({ providerId: resolvedProviderId, entry, data }) =>
          this.createGameResult(resolvedProviderId, entry, data),
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })) as readonly GameScraperImageResult[]

      return mergeGameScraperImages([...results], 'enrich')
    } catch (error) {
      if (isAbortError(error)) {
        throw error
      }

      log.warn('Provider request failed.', error, {
        mediaType: 'game',
        providerId: providerId,
        imageType: imageType
      })
      return []
    } finally {
      await state.dispose()
    }
  }

  private createGameResult<S extends GameScraperSlot>(
    providerId: string,
    entry: PlannedSlotEntry<S>,
    data: GameSessionResultMap[S]
  ): SlotResult<S, GameSessionResultMap[S]> | null {
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
    if (!profile) {
      throw new ScrapeFailure('profile-unavailable', `Profile not found: ${profileId}`)
    }
    if (profile.mediaType !== 'game') {
      throw new ScrapeFailure(
        'profile-unavailable',
        `Profile '${profileId}' is not a game scraper profile`
      )
    }
    return profile
  }

  private requireProvider(providerId: string): GameScraperProvider {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new ScrapeFailure('provider-unavailable', `Provider not found: ${providerId}`)
    }
    return provider
  }

  private requireProviderExternalIdSource(providerId: string): string {
    return this.requireProvider(providerId).externalIdSource
  }
}
