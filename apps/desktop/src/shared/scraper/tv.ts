/**
 * TV Scraper Types
 *
 * Type definitions for TV scraper providers, handlers, and operations.
 * This file contains only TV-specific types.
 */

import { TV_FORMAT_VALUES, type PartialDate, type TvFormat } from '@shared/db'
import type { ExternalId } from '@shared/identity'
import { normalizeMediaLookupFacts, rankReleaseYear, type MediaScraperLookup } from './media'
import type { ScraperCapability } from './slot'

// =============================================================================
// Provider Info
// =============================================================================

/** Information about a registered TV scraper provider */
export interface TvScraperProviderInfo {
  id: string
  name: string
  externalIdSource: string
  capabilities: ScraperCapability[]
}

// =============================================================================
// Lookup
// =============================================================================

/**
 * TV lookup, adding the production format to the shared media facts.
 *
 * The format tells providers which kind of entry to look for when a name search
 * spans several: a franchise name can name a scripted series, its documentary
 * companion, and a talk show at once.
 */
export interface TvScraperLookup extends MediaScraperLookup {
  /** Production format of the entry. */
  format?: TvFormat
}

function matchesTvFormat(value: unknown): value is TvFormat {
  return (TV_FORMAT_VALUES as readonly unknown[]).includes(value)
}

/** Keep only the lookup facts stated in the shape the contract defines. */
export function normalizeTvLookupFacts(lookup: TvScraperLookup): TvScraperLookup {
  return {
    ...normalizeMediaLookupFacts(lookup),
    format: matchesTvFormat(lookup.format) ? lookup.format : undefined
  }
}

/** The facts that tell one show from another. */
export type TvLookupFacts = Pick<TvScraperLookup, 'releaseDate' | 'format'>

// =============================================================================
// Search
// =============================================================================

/** A single TV search result */
export interface TvSearchResult {
  id: string
  name: string
  originalName?: string
  releaseDate?: PartialDate
  format?: TvFormat
  externalIds: ExternalId[]
}

/**
 * Pick the search result a show's own facts point at.
 *
 * A show is one entry per source, so a name search returns unrelated shows
 * rather than pieces of one — remakes, reboots, and same-named productions in
 * other countries. The facts rank them: the format says which kind of show to
 * look for, the first-air year says which production. Rows the facts cannot
 * separate keep the order the provider gave them, so a caller that states no
 * facts lands on the provider's first row.
 */
export function selectTvSearchResult<TResult extends TvLookupFacts>(
  results: readonly TResult[],
  facts: TvLookupFacts
): TResult | null {
  let best: TResult | null = null
  let bestRank = -1

  for (const result of results) {
    // Format outranks date: the kind of show narrows harder than the year.
    const rank = rankTvFormat(result.format, facts.format) * 3 + rankReleaseYear(result, facts)
    if (rank > bestRank) {
      best = result
      bestRank = rank
    }
  }

  return best
}

function rankTvFormat(candidate: TvFormat | undefined, wanted: TvFormat | undefined): number {
  return wanted !== undefined && candidate === wanted ? 2 : 1
}
