/**
 * Company scraper handler with invocation-scoped resolve/session execution.
 */

import { eq } from 'drizzle-orm'
import { createLogger } from '@main/log'
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
import type { SlotResult } from '../../types'

const log = createLogger('Scraper')

type RuntimeCompanyProfile = ScraperProfile & { slotConfigs: CompanyScraperSlotConfigs }

const COMPANY_ALLOWED_CAPABILITIES = new Set(['search', ...COMPANY_SCRAPER_SLOTS] as const)

function hasValidCompanyInfoData(
  data: CompanySessionResultMap['info'],
  strategy: SlotStrategy
): boolean {
  return strategy !== 'first' || (typeof data.name === 'string' && data.name.trim().length > 0)
}

function hasValidCompanySlotData<S extends CompanyScraperSlot>(
  slot: S,
  data: CompanySessionResultMap[S],
  strategy: SlotStrategy
): boolean {
  if (slot === 'info') {
    return hasValidCompanyInfoData(data as CompanySessionResultMap['info'], strategy)
  }

  return Array.isArray(data) && data.length > 0
}

export class CompanyScraperHandler {
  private providers = createProviderRegistry<CompanyScraperProvider>(COMPANY_ALLOWED_CAPABILITIES)

  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private i18n: I18nService
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
    return this.providers.list().map((provider) => ({
      id: provider.id,
      name: provider.name,
      externalIdSource: provider.externalIdSource,
      capabilities: [...provider.capabilities]
    }))
  }

  getProviderInfo(providerId: string): CompanyScraperProviderInfo {
    const provider = this.getSearchProvider(providerId)
    return {
      id: provider.id,
      name: provider.name,
      externalIdSource: provider.externalIdSource,
      capabilities: [...provider.capabilities]
    }
  }

  async search(profileId: string, query: string): Promise<CompanySearchResult[]> {
    const profile = this.loadProfile(profileId)
    const provider = this.getSearchProvider(profile.searchProviderId)
    const results = await provider.search(query, this.getProfileLocale(profile))
    return results.map((result) =>
      ensureProviderExternalId(result, provider.externalIdSource, result.id)
    )
  }

  async scrape(profileId: string, lookup: ScraperLookup): Promise<ScrapedCompanyBundle | null> {
    const profile = this.loadProfile(profileId)

    const runtimeProfile: RuntimeCompanyProfile = {
      ...profile,
      slotConfigs: prepareRuntimeSlotConfigs('company', profile.slotConfigs, this.providers.asMap())
    }

    const resolveLocale = this.getResolveLocale(runtimeProfile, lookup)
    const searchProvider = this.getSearchProvider(runtimeProfile.searchProviderId)
    const plan = buildExecutionPlan<CompanyScraperSlot>({
      slotConfigs: runtimeProfile.slotConfigs,
      resolveLocale: (entry) => this.getFetchLocale(runtimeProfile, entry)
    })
    const state = createScraperInvocationState<
      CompanyResolvedTarget,
      CompanyScraperSession,
      CompanyScraperSlot,
      CompanySessionResultMap,
      CompanyScraperResult
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
        locale: ContentLocale
      ): Promise<CompanyResolvedTarget | null> => {
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
          this.createCompanyResult(providerId, target, entry, data),
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })) as readonly CompanyScraperResult[]

      return mergeCompanyScraperBundle([...results], runtimeProfile, state.getCollectedIdentities())
    } finally {
      await state.dispose()
    }
  }

  async getProviderImages(
    providerId: string,
    lookup: ScraperLookup,
    imageType: CompanyScraperImageSlot
  ): Promise<string[]> {
    const provider = this.providers.get(providerId)
    if (!provider) {
      log.warn('Company provider not available.', { providerId: providerId })
      return []
    }

    if (!provider.capabilities.includes(imageType)) {
      log.warn('Company provider does not support image slot.', {
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
          this.createCompanyResult(resolvedProviderId, target, entry, data),
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })) as readonly CompanyScraperImageResult[]

      return mergeCompanyScraperImages([...results], 'enrich')
    } catch (error) {
      log.warn('Provider request failed.', error, { providerId: providerId, imageType: imageType })
      return []
    } finally {
      await state.dispose()
    }
  }

  private createCompanyResult<S extends CompanyScraperSlot>(
    providerId: string,
    target: CompanyResolvedTarget,
    entry: PlannedSlotEntry<S>,
    data: CompanySessionResultMap[S]
  ): SlotResult<S, CompanySessionResultMap[S]> | null {
    void target

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

    if (!hasValidCompanySlotData(entry.slot, data, entry.strategy)) {
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
    if (!profile) throw new Error(`Profile not found: ${profileId}`)
    if (profile.mediaType !== 'company') {
      throw new Error(`Profile '${profileId}' is not a company scraper profile`)
    }
    return profile
  }

  private getSearchProvider(providerId: string): CompanyScraperProvider {
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
