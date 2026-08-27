/**
 * Shared scraper handler with invocation-scoped resolve/session execution.
 *
 * One class serves every content entity: search, plan-driven scraping, and
 * single-provider image loading. The per-entity vocabulary — slots, lookup
 * normalization, merge — comes from `specs.ts`; provider contracts stay in
 * each entity's folder. This module owns the type correlation between an
 * entity and its payloads, so the few assertions below never leak to callers.
 */

import { eq } from 'drizzle-orm'
import { createLogger } from '@main/log'
import { isAbortError } from '@main/utils/async'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '@shared/db/schema'
import { scraperProfiles, type ScraperProfile } from '@shared/db/schema'
import type { ScraperProviderEntry } from '@shared/db'
import type { SlotStrategy } from '@shared/db/contracts/json'
import type { ScraperCapability, ScraperMediaType } from '@shared/scraper'
import type { I18nService } from '@main/services/i18n'
import {
  createSearchUnsupportedError,
  ensureProviderExternalId,
  ensureProviderIdentity,
  ScrapeFailure
} from '../shared'
import type { ScraperMediaHooks } from '../hooks'
import type {
  IdResolvedTarget,
  ScraperInvocationOptions,
  ScraperProviderContext,
  SlotResult
} from '../types'
import { executeScraperPlan } from './common/executor'
import { resolveContentLocale } from './common/locale'
import {
  buildExecutionPlan,
  buildSingleProviderExecutionPlan,
  prepareRuntimeSlotConfigs,
  type PlannedSlotEntry
} from './common/planner'
import {
  createProviderRegistry,
  toProviderInfo,
  type ScraperProviderRegistry
} from './common/registry'
import { resolveProviderTarget, resolveSearchProviderTarget } from './common/resolve'
import { createScraperInvocationState } from './common/state'
import type {
  ScrapeBundleOf,
  ScrapeImageResultOf,
  ScrapeImageSlotOf,
  ScrapeLookupOf,
  ScrapeProviderInfoOf,
  ScrapeProviderOf,
  ScrapeResultMapOf,
  ScrapeResultOf,
  ScrapeSearchResultOf,
  ScrapeSessionOf,
  ScrapeSlotOf,
  ScraperHandlerSpec
} from './specs'

const log = createLogger('Scraper')

/** Runtime slot-config shape the execution planner consumes. */
type PlannableSlotConfigs<TSlot extends string> = Record<
  TSlot,
  { providers: readonly ScraperProviderEntry[]; strategy: SlotStrategy }
>

/** The slice of a provider the plan executor needs; widening is owned here. */
interface SessionProviderOf<T extends ScraperMediaType> {
  readonly capabilities: readonly string[]
  openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<ScrapeSessionOf<T>>
}

export class EntityScraperHandler<T extends ScraperMediaType> {
  private providers: ScraperProviderRegistry<ScrapeProviderOf<T>>

  constructor(
    private readonly mediaType: T,
    private readonly spec: ScraperHandlerSpec<T>,
    private db: BetterSQLite3Database<typeof schema>,
    private i18n: I18nService,
    private hooks: ScraperMediaHooks<ScrapeLookupOf<T>, ScrapeSearchResultOf<T>, ScrapeBundleOf<T>>
  ) {
    this.providers = createProviderRegistry<ScrapeProviderOf<T>>(
      new Set<ScraperCapability>(['search', ...spec.slots])
    )
  }

  registerProvider(provider: ScrapeProviderOf<T>): void {
    this.providers.register(provider)
    log.info('Registered provider.', { mediaType: this.mediaType, providerId: provider.id })
  }

  unregisterProvider(providerId: string): void {
    this.providers.delete(providerId)
    log.info('Unregistered provider.', { mediaType: this.mediaType, providerId: providerId })
  }

  getProviders(): ScrapeProviderInfoOf<T>[] {
    // Provider info is structurally what `toProviderInfo` returns; the named
    // per-entity info type is this handler's owned correlation.
    return this.providers.list().map((provider) => this.toInfo(provider))
  }

  getProviderInfo(providerId: string): ScrapeProviderInfoOf<T> {
    return this.toInfo(this.requireProvider(providerId))
  }

  async search(
    profileId: string,
    query: string,
    options: ScraperInvocationOptions = {}
  ): Promise<ScrapeSearchResultOf<T>[]> {
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
    rawLookup: ScrapeLookupOf<T>,
    options: ScraperInvocationOptions = {}
  ): Promise<ScrapeBundleOf<T> | null> {
    // Hook taps re-enter the lookup as extension-supplied JSON, so its facts
    // are total-parsed back into the contract before providers rank on them.
    const lookup = this.spec.normalizeLookupFacts(await this.hooks.lookup.transform(rawLookup))
    const profile = this.loadProfile(profileId)

    const runtimeSlotConfigs = prepareRuntimeSlotConfigs(
      this.mediaType,
      profile.slotConfigs,
      this.providers.asMap()
    )
    const runtimeProfile: ScraperProfile = { ...profile, slotConfigs: runtimeSlotConfigs }

    const resolveLocale = resolveContentLocale(lookup.locale, runtimeProfile, this.i18n.locale)
    const searchProvider = this.requireProvider(runtimeProfile.searchProviderId)
    const plan = buildExecutionPlan<ScrapeSlotOf<T>>({
      // The per-media slot-config record is plannable by construction; the
      // widening to the planner's record shape is owned here.
      slotConfigs: runtimeSlotConfigs as PlannableSlotConfigs<ScrapeSlotOf<T>>,
      resolveLocale: (entry) => resolveContentLocale(entry.locale, runtimeProfile, this.i18n.locale)
    })
    const state = createScraperInvocationState<
      IdResolvedTarget,
      ScrapeSessionOf<T>,
      ScrapeSlotOf<T>,
      ScrapeResultMapOf<T>,
      ScrapeResultOf<T>
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

      const resolveProviderId = async (providerId: string): Promise<IdResolvedTarget | null> => {
        const provider = this.providers.get(providerId)
        if (!provider) {
          log.warn('Provider not available.', { mediaType: this.mediaType, providerId: providerId })
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
        getProvider: (providerId) => this.sessionProvider(providerId),
        resolveProviderTarget: resolveProviderId,
        collectResolvedIdentity: ({ providerId, target }) =>
          state.collectIdentity(this.createTargetIdentity(providerId, target)),
        buildResult: ({ providerId, entry, data }) =>
          this.createResult(providerId, entry, data) as ScrapeResultOf<T> | null,
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })) as readonly ScrapeResultOf<T>[]

      const bundle = this.spec.mergeBundle(
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
    lookup: ScrapeLookupOf<T>,
    imageType: ScrapeImageSlotOf<T>,
    options: ScraperInvocationOptions = {}
  ): Promise<string[]> {
    const provider = this.providers.get(providerId)
    if (!provider) {
      log.warn('Provider not available.', { mediaType: this.mediaType, providerId: providerId })
      return []
    }

    if (!provider.capabilities.includes(imageType)) {
      log.warn('Provider does not support image slot.', {
        mediaType: this.mediaType,
        providerId: providerId,
        imageType: imageType
      })
      return []
    }

    const locale = lookup.locale ?? this.i18n.locale
    const plan = buildSingleProviderExecutionPlan<ScrapeImageSlotOf<T>>({
      providerId,
      slot: imageType,
      locale
    })
    const state = createScraperInvocationState<
      IdResolvedTarget,
      ScrapeSessionOf<T>,
      ScrapeSlotOf<T>,
      ScrapeResultMapOf<T>,
      ScrapeImageResultOf<T>
    >()

    try {
      const results = (await executeScraperPlan({
        state,
        plan,
        signal: options.signal,
        getProvider: (candidateProviderId) => this.sessionProvider(candidateProviderId),
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
          this.createResult(resolvedProviderId, entry, data) as ScrapeImageResultOf<T> | null,
        warn: (message, error) => log.warn('Scraper provider warning.', error, { message })
      })) as readonly ScrapeImageResultOf<T>[]

      return this.spec.mergeImages([...results], 'enrich')
    } catch (error) {
      if (isAbortError(error)) {
        throw error
      }

      log.warn('Provider request failed.', error, {
        mediaType: this.mediaType,
        providerId: providerId,
        imageType: imageType
      })
      return []
    } finally {
      await state.dispose()
    }
  }

  private createResult<S extends ScrapeSlotOf<T>>(
    providerId: string,
    entry: PlannedSlotEntry<S>,
    data: ScrapeResultMapOf<T>[S]
  ): SlotResult<S, ScrapeResultMapOf<T>[S]> | null {
    if (entry.slot === 'info') {
      // The info slot is the one object-shaped payload; a first-strategy info
      // answer without a usable name is no answer.
      const info = data as { name?: unknown }
      const valid =
        entry.strategy !== 'first' ||
        (typeof info.name === 'string' && info.name.trim().length > 0)
      return valid ? { slot: entry.slot, providerId, rank: entry.rank, data } : null
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

  private toInfo(provider: ScrapeProviderOf<T>): ScrapeProviderInfoOf<T> {
    return toProviderInfo(provider) as ScrapeProviderInfoOf<T>
  }

  private sessionProvider(providerId: string): SessionProviderOf<T> | undefined {
    // Every registered provider satisfies the session slice by the spec map's
    // construction; the compiler cannot see through the generic intersection.
    return this.providers.get(providerId) as SessionProviderOf<T> | undefined
  }

  private createTargetIdentity(providerId: string, target: IdResolvedTarget) {
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
    if (profile.mediaType !== this.mediaType) {
      throw new ScrapeFailure(
        'profile-unavailable',
        `Profile '${profileId}' is not a ${this.mediaType} scraper profile`
      )
    }
    return profile
  }

  private requireProvider(providerId: string): ScrapeProviderOf<T> {
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
