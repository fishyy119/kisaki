/**
 * Novel scraper handler with invocation-scoped resolve/session execution.
 */

import { eq } from 'drizzle-orm'
import { createLogger } from '@main/log'
import { isAbortError } from '@main/utils/async'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '@shared/db/schema'
import { scraperProfiles, type ScraperProfile } from '@shared/db/schema'
import { NOVEL_SCRAPER_SLOTS } from '@shared/db/contracts/constants'
import type {
  NovelScraperSlot,
  NovelScraperSlotConfigs,
  SlotStrategy
} from '@shared/db/contracts/json'
import { normalizeNovelLookupFacts, type NovelImageSlot } from '@shared/scraper'
import type {
  NovelScraperLookup,
  NovelScraperProviderInfo,
  NovelSearchResult,
  ScrapedNovelBundle
} from '@shared/scraper'
import type { I18nService } from '@main/services/i18n'
import {
  createSearchUnsupportedError,
  ensureProviderExternalId,
  ensureProviderIdentity,
  ScrapeFailure
} from '../../shared'
import { executeScraperPlan } from '../common/executor'
import { resolveContentLocale } from '../common/locale'
import {
  buildExecutionPlan,
  buildSingleProviderExecutionPlan,
  prepareRuntimeSlotConfigs,
  type PlannedSlotEntry
} from '../common/planner'
import { createProviderRegistry, toProviderInfo } from '../common/registry'
import { resolveProviderTarget, resolveSearchProviderTarget } from '../common/resolve'
import { createScraperInvocationState } from '../common/state'
import { mergeNovelScraperBundle, mergeNovelScraperImages } from './merge'
import type {
  NovelResolvedTarget,
  NovelScraperProvider,
  NovelScraperSession,
  NovelSessionResultMap
} from './provider'
import type { NovelScraperImageResult, NovelScraperResult } from './types'
import type { ScraperMediaHooks } from '../../hooks'
import type { ScraperInvocationOptions, SlotResult } from '../../types'

const log = createLogger('Scraper')

type RuntimeNovelProfile = ScraperProfile & { slotConfigs: NovelScraperSlotConfigs }

const NOVEL_ALLOWED_CAPABILITIES = new Set(['search', ...NOVEL_SCRAPER_SLOTS] as const)

function hasValidNovelInfoData(
  data: NovelSessionResultMap['info'],
  strategy: SlotStrategy
): boolean {
  return strategy !== 'first' || (typeof data.name === 'string' && data.name.trim().length > 0)
}

export class NovelScraperHandler {
  private providers = createProviderRegistry<NovelScraperProvider>(NOVEL_ALLOWED_CAPABILITIES)

  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private i18n: I18nService,
    private hooks: ScraperMediaHooks<NovelScraperLookup, NovelSearchResult, ScrapedNovelBundle>
  ) {}

  registerProvider(provider: NovelScraperProvider): void {
    this.providers.register(provider)
    log.info('Registered provider.', { providerId: provider.id })
  }

  unregisterProvider(providerId: string): void {
    this.providers.delete(providerId)
    log.info('Unregistered provider.', { providerId: providerId })
  }

  getProviders(): NovelScraperProviderInfo[] {
    return this.providers.list().map(toProviderInfo)
  }

  getProviderInfo(providerId: string): NovelScraperProviderInfo {
    return toProviderInfo(this.requireProvider(providerId))
  }

  async search(
    profileId: string,
    query: string,
    options: ScraperInvocationOptions = {}
  ): Promise<NovelSearchResult[]> {
    const profile = this.loadProfile(profileId)
    const provider = this.requireProvider(profile.searchProviderId)
    if (!provider.search) {
      throw createSearchUnsupportedError(profile.searchProviderId)
    }

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
    rawLookup: NovelScraperLookup,
    options: ScraperInvocationOptions = {}
  ): Promise<ScrapedNovelBundle | null> {
    // Hook taps re-enter the lookup as extension-supplied JSON, so its facts
    // are total-parsed back into the contract before providers rank on them.
    const lookup = normalizeNovelLookupFacts(await this.hooks.lookup.transform(rawLookup))
    const profile = this.loadProfile(profileId)

    const runtimeProfile: RuntimeNovelProfile = {
      ...profile,
      slotConfigs: prepareRuntimeSlotConfigs('novel', profile.slotConfigs, this.providers.asMap())
    }

    const resolveLocale = resolveContentLocale(lookup.locale, runtimeProfile, this.i18n.locale)
    const searchProvider = this.requireProvider(runtimeProfile.searchProviderId)
    const plan = buildExecutionPlan<NovelScraperSlot>({
      slotConfigs: runtimeProfile.slotConfigs,
      resolveLocale: (entry) => resolveContentLocale(entry.locale, runtimeProfile, this.i18n.locale)
    })
    const state = createScraperInvocationState<
      NovelResolvedTarget,
      NovelScraperSession,
      NovelScraperSlot,
      NovelSessionResultMap,
      NovelScraperResult
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

      const resolveProviderId = async (providerId: string): Promise<NovelResolvedTarget | null> => {
        const provider = this.providers.get(providerId)
        if (!provider) {
          log.warn('Provider not available.', { mediaType: 'novel', providerId: providerId })
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
          this.createNovelResult(providerId, entry, data),
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })) as readonly NovelScraperResult[]

      const bundle = mergeNovelScraperBundle(
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
    lookup: NovelScraperLookup,
    imageType: NovelImageSlot,
    options: ScraperInvocationOptions = {}
  ): Promise<string[]> {
    const provider = this.providers.get(providerId)
    if (!provider) {
      log.warn('Provider not available.', { mediaType: 'novel', providerId: providerId })
      return []
    }

    if (!provider.capabilities.includes(imageType)) {
      log.warn('Provider does not support image slot.', {
        mediaType: 'novel',
        providerId: providerId,
        imageType: imageType
      })
      return []
    }

    const locale = lookup.locale ?? this.i18n.locale
    const plan = buildSingleProviderExecutionPlan<NovelImageSlot>({
      providerId,
      slot: imageType,
      locale
    })
    const state = createScraperInvocationState<
      NovelResolvedTarget,
      NovelScraperSession,
      NovelScraperSlot,
      NovelSessionResultMap,
      NovelScraperImageResult
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
          this.createNovelResult(resolvedProviderId, entry, data),
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })) as readonly NovelScraperImageResult[]

      return mergeNovelScraperImages([...results], 'enrich')
    } catch (error) {
      if (isAbortError(error)) {
        throw error
      }

      log.warn('Provider request failed.', error, {
        mediaType: 'novel',
        providerId: providerId,
        imageType: imageType
      })
      return []
    } finally {
      await state.dispose()
    }
  }

  private createNovelResult<S extends NovelScraperSlot>(
    providerId: string,
    entry: PlannedSlotEntry<S>,
    data: NovelSessionResultMap[S]
  ): SlotResult<S, NovelSessionResultMap[S]> | null {
    if (entry.slot === 'info') {
      const normalized = data as NovelSessionResultMap['info']

      return hasValidNovelInfoData(normalized, entry.strategy)
        ? ({
            slot: entry.slot,
            providerId,
            rank: entry.rank,
            data: normalized
          } as SlotResult<S, NovelSessionResultMap[S]>)
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

  private createTargetIdentity(providerId: string, target: NovelResolvedTarget) {
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
    if (profile.mediaType !== 'novel') {
      throw new ScrapeFailure(
        'profile-unavailable',
        `Profile '${profileId}' is not a novel scraper profile`
      )
    }
    return profile
  }

  private requireProvider(providerId: string): NovelScraperProvider {
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
