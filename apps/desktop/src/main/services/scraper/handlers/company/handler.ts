/**
 * Company scraper handler with invocation-scoped resolve/session execution.
 */

import { eq } from 'drizzle-orm'
import { createLogger } from '@main/log'
import { isAbortError } from '@main/utils/async'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '@shared/db/schema'
import { scraperProfiles, type ScraperProfile } from '@shared/db/schema'
import { COMPANY_SCRAPER_SLOTS } from '@shared/db/contracts/constants'
import type {
  CompanyScraperSlot,
  CompanyScraperSlotConfigs,
  SlotStrategy
} from '@shared/db/contracts/json'
import type {
  CompanyScraperProviderInfo,
  CompanySearchResult,
  ScrapedCompanyBundle,
  ScraperLookup
} from '@shared/scraper'
import type { I18nService } from '@main/services/i18n'
import {
  createSearchUnsupportedError,
  ensureProviderExternalId,
  ensureProviderIdentity,
  ScrapeFailure
} from '../../shared'
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
import { mergeCompanyScraperBundle, mergeCompanyScraperImages } from './merge'
import type {
  CompanyResolvedTarget,
  CompanyScraperProvider,
  CompanyScraperSession,
  CompanySessionResultMap
} from './provider'
import type {
  CompanyScraperImageResult,
  CompanyScraperImageSlot,
  CompanyScraperResult
} from './types'
import type { ScraperMediaHooks } from '../../hooks'
import type { ScraperInvocationOptions, SlotResult } from '../../types'

const log = createLogger('Scraper')

type RuntimeCompanyProfile = ScraperProfile & { slotConfigs: CompanyScraperSlotConfigs }

const COMPANY_ALLOWED_CAPABILITIES = new Set(['search', ...COMPANY_SCRAPER_SLOTS] as const)

function hasValidCompanyInfoData(
  data: CompanySessionResultMap['info'],
  strategy: SlotStrategy
): boolean {
  return strategy !== 'first' || (typeof data.name === 'string' && data.name.trim().length > 0)
}

export class CompanyScraperHandler {
  private providers = createProviderRegistry<CompanyScraperProvider>(COMPANY_ALLOWED_CAPABILITIES)

  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private i18n: I18nService,
    private hooks: ScraperMediaHooks<ScraperLookup, CompanySearchResult, ScrapedCompanyBundle>
  ) {}

  registerProvider(provider: CompanyScraperProvider): void {
    this.providers.register(provider)
    log.info('Registered company provider.', { providerId: provider.id })
  }

  unregisterProvider(providerId: string): void {
    this.providers.delete(providerId)
    log.info('Unregistered company provider.', { providerId: providerId })
  }

  getProviders(): CompanyScraperProviderInfo[] {
    return this.providers.list().map(toProviderInfo)
  }

  getProviderInfo(providerId: string): CompanyScraperProviderInfo {
    return toProviderInfo(this.requireProvider(providerId))
  }

  async search(
    profileId: string,
    query: string,
    options: ScraperInvocationOptions = {}
  ): Promise<CompanySearchResult[]> {
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
    rawLookup: ScraperLookup,
    options: ScraperInvocationOptions = {}
  ): Promise<ScrapedCompanyBundle | null> {
    const lookup = await this.hooks.lookup.transform(rawLookup)
    const profile = this.loadProfile(profileId)

    const runtimeProfile: RuntimeCompanyProfile = {
      ...profile,
      slotConfigs: prepareRuntimeSlotConfigs('company', profile.slotConfigs, this.providers.asMap())
    }

    const resolveLocale = resolveContentLocale(lookup.locale, runtimeProfile, this.i18n.locale)
    const searchProvider = this.requireProvider(runtimeProfile.searchProviderId)
    const plan = buildExecutionPlan<CompanyScraperSlot>({
      slotConfigs: runtimeProfile.slotConfigs,
      resolveLocale: (entry) => resolveContentLocale(entry.locale, runtimeProfile, this.i18n.locale)
    })
    const state = createScraperInvocationState<
      CompanyResolvedTarget,
      CompanyScraperSession,
      CompanyScraperSlot,
      CompanySessionResultMap,
      CompanyScraperResult
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
        providerId: string
      ): Promise<CompanyResolvedTarget | null> => {
        const provider = this.providers.get(providerId)
        if (!provider) {
          log.warn('Provider not available.', { mediaType: 'company', providerId: providerId })
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
          this.createCompanyResult(providerId, entry, data),
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })) as readonly CompanyScraperResult[]

      const bundle = mergeCompanyScraperBundle(
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
    imageType: CompanyScraperImageSlot,
    options: ScraperInvocationOptions = {}
  ): Promise<string[]> {
    const provider = this.providers.get(providerId)
    if (!provider) {
      log.warn('Provider not available.', { mediaType: 'company', providerId: providerId })
      return []
    }

    if (!provider.capabilities.includes(imageType)) {
      log.warn('Provider does not support image slot.', {
        mediaType: 'company',
        providerId: providerId,
        imageType: imageType
      })
      return []
    }

    const locale = lookup.locale ?? this.i18n.locale
    const plan = buildSingleProviderExecutionPlan<CompanyScraperImageSlot>({
      providerId,
      slot: imageType,
      locale
    })
    const state = createScraperInvocationState<
      CompanyResolvedTarget,
      CompanyScraperSession,
      CompanyScraperSlot,
      CompanySessionResultMap,
      CompanyScraperImageResult
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
          this.createCompanyResult(resolvedProviderId, entry, data),
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })) as readonly CompanyScraperImageResult[]

      return mergeCompanyScraperImages([...results], 'enrich')
    } catch (error) {
      if (isAbortError(error)) {
        throw error
      }

      log.warn('Provider request failed.', error, {
        mediaType: 'company',
        providerId: providerId,
        imageType: imageType
      })
      return []
    } finally {
      await state.dispose()
    }
  }

  private createCompanyResult<S extends CompanyScraperSlot>(
    providerId: string,
    entry: PlannedSlotEntry<S>,
    data: CompanySessionResultMap[S]
  ): SlotResult<S, CompanySessionResultMap[S]> | null {
    if (entry.slot === 'info') {
      const normalized = data as CompanySessionResultMap['info']

      return hasValidCompanyInfoData(normalized, entry.strategy)
        ? ({
            slot: entry.slot,
            providerId,
            rank: entry.rank,
            data: normalized
          } as SlotResult<S, CompanySessionResultMap[S]>)
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

  private createTargetIdentity(providerId: string, target: CompanyResolvedTarget) {
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
    if (profile.mediaType !== 'company') {
      throw new ScrapeFailure(
        'profile-unavailable',
        `Profile '${profileId}' is not a company scraper profile`
      )
    }
    return profile
  }

  private requireProvider(providerId: string): CompanyScraperProvider {
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
