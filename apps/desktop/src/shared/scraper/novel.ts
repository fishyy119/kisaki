/**
 * Novel Scraper Types
 *
 * Type definitions for novel scraper providers, handlers, and operations.
 * This file contains only novel-specific types.
 */

import { NOVEL_FORMAT_VALUES, type NovelFormat, type PartialDate } from '@shared/db'
import type { ExternalId } from '@shared/identity'
import { normalizeMediaLookupFacts, rankReleaseYear, type MediaScraperLookup } from './media'
import type { ScraperCapability } from './slot'

// =============================================================================
// Provider Info
// =============================================================================

/** Information about a registered novel scraper provider */
export interface NovelScraperProviderInfo {
  id: string
  name: string
  externalIdSource: string
  capabilities: ScraperCapability[]
}

// =============================================================================
// Lookup
// =============================================================================

/**
 * Novel lookup, adding the release format to the shared media facts.
 *
 * The format tells providers which kind of entry to look for when a name
 * search spans several: a web serialization and its print edition share a
 * name.
 */
export interface NovelScraperLookup extends MediaScraperLookup {
  /** Release format of the entry. */
  format?: NovelFormat
}

function matchesNovelFormat(value: unknown): value is NovelFormat {
  return (NOVEL_FORMAT_VALUES as readonly unknown[]).includes(value)
}

/** Keep only the lookup facts stated in the shape the contract defines. */
export function normalizeNovelLookupFacts(lookup: NovelScraperLookup): NovelScraperLookup {
  return {
    ...normalizeMediaLookupFacts(lookup),
    format: matchesNovelFormat(lookup.format) ? lookup.format : undefined
  }
}

/** The facts that tell one entry of a work from another. */
export type NovelLookupFacts = Pick<NovelScraperLookup, 'releaseDate' | 'format'>

// =============================================================================
// Search
// =============================================================================

/** A single novel search result */
export interface NovelSearchResult {
  id: string
  name: string
  originalName?: string
  releaseDate?: PartialDate
  format?: NovelFormat
  externalIds: ExternalId[]
}

/**
 * Pick the search result an entry's own facts point at.
 *
 * A name search spans every entry of a work: the web serialization and its
 * print edition are separate entries with the same name. The facts rank them
 * instead of trusting provider order — the format says which kind of entry to
 * look for, the release date says which one of that kind. Rows the facts
 * cannot separate keep the order the provider gave them.
 */
export function selectNovelSearchResult<TResult extends NovelLookupFacts>(
  results: readonly TResult[],
  facts: NovelLookupFacts
): TResult | null {
  let best: TResult | null = null
  let bestRank = -1

  for (const result of results) {
    // Format outranks date: the kind of entry narrows harder than the year.
    const rank = rankNovelFormat(result.format, facts.format) * 3 + rankReleaseYear(result, facts)
    if (rank > bestRank) {
      best = result
      bestRank = rank
    }
  }

  return best
}

function rankNovelFormat(
  candidate: NovelFormat | undefined,
  wanted: NovelFormat | undefined
): number {
  return wanted !== undefined && candidate === wanted ? 2 : 1
}
