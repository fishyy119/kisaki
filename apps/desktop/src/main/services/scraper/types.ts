/**
 * Shared runtime types for the main-process scraper pipeline.
 */

import type { NetworkService } from '@main/services/network'
import type { Logger } from '@main/log'
import type { PartialDate } from '@shared/db'
import type { ContentLocale } from '@shared/i18n'
import type { ScrapedEntityIdentity, ScraperLookup, ScraperSessionResult } from '@shared/scraper'

type ScraperLogger = Logger

/**
 * Invocation-scoped parameters every provider call receives.
 *
 * The host always resolves a locale, so providers never re-derive it. `signal`
 * aborts in-flight network work when the caller gives up; a provider that
 * ignores it stays correct but keeps running until its requests finish.
 */
export interface ScraperProviderContext {
  locale: ContentLocale
  signal?: AbortSignal
}

/**
 * Caller-supplied options for a handler-level scraper invocation.
 */
export interface ScraperInvocationOptions {
  signal?: AbortSignal
}

/**
 * Provider-specific target resolved from a cross-provider scraper lookup.
 */
export interface BaseResolvedTarget {
  /** Stable per-provider cache key within a single invocation. */
  cacheKey: string
  /** Optional canonical name discovered during resolve. */
  resolveName?: string
  /** Optional identity evidence discovered while resolving the provider target. */
  identity?: ScrapedEntityIdentity
}

/**
 * Default resolved-target shape used by the current scraper media runtimes.
 */
export interface IdResolvedTarget extends BaseResolvedTarget {
  id: string
}

/**
 * Invocation-scoped session opened for a resolved provider target.
 */
export interface BaseScraperSession<
  TSlot extends string,
  TResultMap extends Partial<Record<TSlot, unknown>>
> {
  /**
   * Fetch one or more slots using the provider's preferred resource topology.
   *
   * Slot presence is authoritative: omit a slot the provider cannot answer, and
   * return an empty collection only when the source states there is nothing.
   */
  get(slots: readonly TSlot[]): Promise<ScraperSessionResult<TResultMap>>

  /**
   * Release invocation-scoped resources when the host finishes the session.
   */
  dispose?(): Promise<void>
}

/**
 * Lookup helpers shared across built-in and extension providers.
 */
export interface ScraperProviderLookupHelpers {
  findKnownId(lookup: ScraperLookup, externalIdSource: string): string | undefined
}

/**
 * Date helpers shared across built-in and extension providers.
 */
export interface ScraperProviderDateHelpers {
  parsePartialDate(input: string | null | undefined): PartialDate | undefined
}

/**
 * Text normalization helpers shared across built-in and extension providers.
 */
export interface ScraperProviderTextHelpers {
  normalizeDescription(value: string | null | undefined): string | undefined
}

/**
 * Resolved-target helpers shared across built-in scraper providers.
 */
export interface ScraperProviderTargetHelpers {
  createResolvedTarget(
    id: string,
    resolveName?: string,
    identity?: ScrapedEntityIdentity
  ): IdResolvedTarget
}

/**
 * Stable helper contract available to scraper providers.
 */
export interface ScraperProviderHelpers {
  lookup: ScraperProviderLookupHelpers
  date: ScraperProviderDateHelpers
  text: ScraperProviderTextHelpers
  target: ScraperProviderTargetHelpers
}

/**
 * Stable runtime dependencies that scraper providers may depend on.
 */
export interface ScraperProviderDeps {
  network: NetworkService
  log: ScraperLogger
  helper: ScraperProviderHelpers
}

/**
 * Normalized handler-to-merge result container.
 */
export type SlotResult<S extends string, D> = {
  slot: S
  providerId: string
  rank: number
  data: D
}
