/**
 * Comic Scraper Types
 *
 * Type definitions for comic scraper providers, handlers, and operations.
 * This file contains only comic-specific types.
 */

import { COMIC_FORMAT_VALUES, type ComicFormat, type PartialDate } from '@shared/db'
import type { ExternalId } from '@shared/identity'
import {
  normalizeMediaLookupFacts,
  rankEntryGrain,
  rankReleaseYear,
  type MediaEntryGrain,
  type MediaScraperLookup
} from './media'
import type { ScraperCapability } from './slot'

// =============================================================================
// Provider Info
// =============================================================================

/** Information about a registered comic scraper provider */
export interface ComicScraperProviderInfo {
  id: string
  name: string
  externalIdSource: string
  capabilities: ScraperCapability[]
}

// =============================================================================
// Lookup
// =============================================================================

/**
 * Comic lookup, adding the release format to the shared media facts.
 *
 * The format tells providers which kind of entry to look for when a name
 * search spans several: a serialization and its doujinshi spin-offs share a
 * name.
 */
export interface ComicScraperLookup extends MediaScraperLookup {
  /** Release format of the entry. */
  format?: ComicFormat
}

function matchesComicFormat(value: unknown): value is ComicFormat {
  return (COMIC_FORMAT_VALUES as readonly unknown[]).includes(value)
}

/** Keep only the lookup facts stated in the shape the contract defines. */
export function normalizeComicLookupFacts(lookup: ComicScraperLookup): ComicScraperLookup {
  return {
    ...normalizeMediaLookupFacts(lookup),
    format: matchesComicFormat(lookup.format) ? lookup.format : undefined
  }
}

/** The facts that tell one entry of a work from another. */
export type ComicLookupFacts = Pick<ComicScraperLookup, 'releaseDate' | 'format'>

// =============================================================================
// Search
// =============================================================================

/** A single comic search result */
export interface ComicSearchResult {
  id: string
  name: string
  originalName?: string
  releaseDate?: PartialDate
  format?: ComicFormat
  /** Layer this row sits at, for sources that list works and volumes together. */
  grain?: MediaEntryGrain
  externalIds: ExternalId[]
}

/** The candidate-side facts the selection ranks on. */
type ComicSearchCandidate = ComicLookupFacts & { grain?: MediaEntryGrain }

/**
 * Pick the search result an entry's own facts point at.
 *
 * A name search spans every entry of a work: the serialization, its individual
 * volumes, plus its doujinshi and spin-offs. The facts rank them instead of
 * trusting provider order — the format says which kind of entry to look for,
 * the grain says the work rather than one of its volumes, and the release date
 * says which one of that kind. Rows the facts cannot separate keep the order
 * the provider gave them, and doujinshi rank last unless asked for, so a
 * caller that states no facts lands on the provider's first original entry.
 */
export function selectComicSearchResult<TResult extends ComicSearchCandidate>(
  results: readonly TResult[],
  facts: ComicLookupFacts
): TResult | null {
  let best: TResult | null = null
  let bestRank = -1

  for (const result of results) {
    // Strict priority format > grain > date: each tier outweighs everything
    // below it, because the kind of entry narrows harder than the layer, which
    // narrows harder than the year.
    const rank =
      rankComicFormat(result.format, facts.format) * 9 +
      rankEntryGrain(result.grain) * 3 +
      rankReleaseYear(result, facts)
    if (rank > bestRank) {
      best = result
      bestRank = rank
    }
  }

  return best
}

function rankComicFormat(
  candidate: ComicFormat | undefined,
  wanted: ComicFormat | undefined
): number {
  if (wanted !== undefined && candidate === wanted) {
    return 2
  }

  // Doujinshi are what a name search offers that a caller almost never means,
  // so they rank last unless they were asked for.
  return candidate === 'doujinshi' ? 0 : 1
}
