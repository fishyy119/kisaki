/**
 * TV scraper handler with invocation-scoped resolve/session execution.
 */

import { eq } from 'drizzle-orm'
import { createLogger } from '@main/log'
import { isAbortError } from '@main/utils/async'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '@shared/db/schema'
import { scraperProfiles, type ScraperProfile } from '@shared/db/schema'
import { TV_SCRAPER_SLOTS } from '@shared/db/contracts/constants'
import type { SlotStrategy, TvScraperSlot, TvScraperSlotConfigs } from '@shared/db/contracts/json'
import { normalizeTvLookupFacts, type TvImageSlot } from '@shared/scraper'
import type {
  ScrapedTvBundle,
  TvScraperLookup,
  TvScraperProviderInfo,
  TvSearchResult
} from '@shared/scraper'
import type { I18nService } from '@main/services/i18n'
import { ensureProviderExternalId, ensureProviderIdentity, ScrapeFailure } from '../../shared'
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
import { mergeTvScraperBundle, mergeTvScraperImages } from './merge'
import type {
  TvResolvedTarget,
  TvScraperProvider,
  TvScraperSession,
  TvSessionResultMap
} from './provider'
import type { TvScraperImageResult, TvScraperResult } from './types'
import type { ScraperMediaHooks } from '../../hooks'
import type { ScraperInvocationOptions, SlotResult } from '../../types'

const log = createLogger('Scraper')

type RuntimeTvProfile = ScraperProfile & { slotConfigs: TvScraperSlotConfigs }

const TV_ALLOWED_CAPABILITIES = new Set(['search', ...TV_SCRAPER_SLOTS] as const)

function hasValidTvInfoData(data: TvSessionResultMap['info'], strategy: SlotStrategy): boolean {
  return strategy !== 'first' || (typeof data.name === 'string' && data.name.trim().length > 0)
}

export class TvScraperHandler {
  private providers = createProviderRegistry<TvScraperProvider>(TV_ALLOWED_CAPABILITIES)

  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private i18n: I18nService,
    private hooks: ScraperMediaHooks<TvScraperLookup, TvSearchResult, ScrapedTvBundle>
  ) {}

  registerProvider(provider: TvScraperProvider): void {
    this.providers.register(provider)
    log.info('Registered provider.', { providerId: provider.id })
  }

  unregisterProvider(providerId: string): void {
    this.providers.delete(providerId)
    log.info('Unregistered provider.', { providerId: providerId })
  }

  getProviders(): TvScraperProviderInfo[] {
    return this.providers.list().map(toProviderInfo)
  }

  getProviderInfo(providerId: string): TvScraperProviderInfo {
    return toProviderInfo(this.requireProvider(providerId))
  }

  async search(
    profileId: string,
    query: string,
    options: ScraperInvocationOptions = {}
  ): Promise<TvSearchResult[]> {
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
    rawLookup: TvScraperLookup,
    options: ScraperInvocationOptions = {}
  ): Promise<ScrapedTvBundle | null> {
    // Hook taps re-enter the lookup as extension-supplied JSON, so its facts
    // are total-parsed back into the contract before providers rank on them.
    const lookup = normalizeTvLookupFacts(await this.hooks.lookup.transform(rawLookup))
    const profile = this.loadProfile(profileId)

    const runtimeProfile: RuntimeTvProfile = {
      ...profile,
      slotConfigs: prepareRuntimeSlotConfigs('tv', profile.slotConfigs, this.providers.asMap())
    }

    const resolveLocale = resolveContentLocale(lookup.locale, runtimeProfile, this.i18n.locale)
    const searchProvider = this.requireProvider(runtimeProfile.searchProviderId)
    const plan = buildExecutionPlan<TvScraperSlot>({
      slotConfigs: runtimeProfile.slotConfigs,
      resolveLocale: (entry) => resolveContentLocale(entry.locale, runtimeProfile, this.i18n.locale)
    })
    const state = createScraperInvocationState<
      TvResolvedTarget,
      TvScraperSession,
      TvScraperSlot,
      TvSessionResultMap,
      TvScraperResult
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

      const resolveProviderId = async (providerId: string): Promise<TvResolvedTarget | null> => {
        const provider = this.providers.get(providerId)
        if (!provider) {
          log.warn('Provider not available.', { mediaType: 'tv', providerId: providerId })
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
        buildResult: ({ providerId, entry, data }) => this.createTvResult(providerId, entry, data),
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })) as readonly TvScraperResult[]

      const bundle = mergeTvScraperBundle(
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
    lookup: TvScraperLookup,
    imageType: TvImageSlot,
    options: ScraperInvocationOptions = {}
  ): Promise<string[]> {
    const provider = this.providers.get(providerId)
    if (!provider) {
      log.warn('Provider not available.', { mediaType: 'tv', providerId: providerId })
      return []
    }

    if (!provider.capabilities.includes(imageType)) {
      log.warn('Provider does not support image slot.', {
        mediaType: 'tv',
        providerId: providerId,
        imageType: imageType
      })
      return []
    }

    const locale = lookup.locale ?? this.i18n.locale
    const plan = buildSingleProviderExecutionPlan<TvImageSlot>({
      providerId,
      slot: imageType,
      locale
    })
    const state = createScraperInvocationState<
      TvResolvedTarget,
      TvScraperSession,
      TvScraperSlot,
      TvSessionResultMap,
      TvScraperImageResult
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
          this.createTvResult(resolvedProviderId, entry, data),
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })) as readonly TvScraperImageResult[]

      return mergeTvScraperImages([...results], 'enrich')
    } catch (error) {
      if (isAbortError(error)) {
        throw error
      }

      log.warn('Provider request failed.', error, {
        mediaType: 'tv',
        providerId: providerId,
        imageType: imageType
      })
      return []
    } finally {
      await state.dispose()
    }
  }

  private createTvResult<S extends TvScraperSlot>(
    providerId: string,
    entry: PlannedSlotEntry<S>,
    data: TvSessionResultMap[S]
  ): SlotResult<S, TvSessionResultMap[S]> | null {
    if (entry.slot === 'info') {
      const normalized = data as TvSessionResultMap['info']

      return hasValidTvInfoData(normalized, entry.strategy)
        ? ({
            slot: entry.slot,
            providerId,
            rank: entry.rank,
            data: normalized
          } as SlotResult<S, TvSessionResultMap[S]>)
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

  private createTargetIdentity(providerId: string, target: TvResolvedTarget) {
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
    if (profile.mediaType !== 'tv') {
      throw new ScrapeFailure(
        'profile-unavailable',
        `Profile '${profileId}' is not a tv scraper profile`
      )
    }
    return profile
  }

  private requireProvider(providerId: string): TvScraperProvider {
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
