/**
 * Shared runtime types for the main-process scraper pipeline.
 */

import type { NetworkService } from '@main/services/network'
import type { PartialDate } from '@shared/db'
import type { ScraperLookup } from '@shared/scraper'

type ScraperLogger = typeof import('electron-log/main').default

/**
 * Provider-specific target resolved from a cross-provider scraper lookup.
 */
export interface BaseResolvedTarget {
  /** Stable per-provider cache key within a single invocation. */
  cacheKey: string
  /** Optional canonical name discovered during resolve. */
  resolveName?: string
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
   */
  get(slots: readonly TSlot[]): Promise<Partial<TResultMap>>

  /**
   * Release invocation-scoped resources when the host finishes the session.
   */
  dispose?(): Promise<void>
}

/**
 * Lookup helpers shared across built-in and extension providers.
 */
export interface ScraperProviderLookupHelpers {
  findKnownId(lookup: ScraperLookup, providerId: string): string | undefined
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
  createResolvedTarget(id: string, resolveName?: string): IdResolvedTarget
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
