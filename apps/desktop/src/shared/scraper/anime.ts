/**
 * Anime Scraper Types
 *
 * Type definitions for anime scraper providers, handlers, and operations.
 * This file contains only anime-specific types.
 */

import { ANIME_FORMAT_VALUES, type AnimeFormat, type PartialDate } from '@shared/db'
import type { ExternalId } from '@shared/identity'
import { normalizeMediaLookupFacts, rankReleaseYear, type MediaScraperLookup } from './media'
import type { ScraperCapability } from './slot'

// =============================================================================
// Provider Info
// =============================================================================

/** Information about a registered anime scraper provider */
export interface AnimeScraperProviderInfo {
  id: string
  name: string
  externalIdSource: string
  capabilities: ScraperCapability[]
}

// =============================================================================
// Lookup
// =============================================================================

/**
 * Anime lookup, adding the release format to the shared media facts.
 *
 * The format tells providers which kind of entry to look for when a name search
 * spans several: TMDB lists a show's seasons, its specials collection and its
 * movies under one name.
 */
export interface AnimeScraperLookup extends MediaScraperLookup {
  /** Release format of the entry. */
  format?: AnimeFormat
}

function matchesAnimeFormat(value: unknown): value is AnimeFormat {
  return (ANIME_FORMAT_VALUES as readonly unknown[]).includes(value)
}

/** Keep only the lookup facts stated in the shape the contract defines. */
export function normalizeAnimeLookupFacts(lookup: AnimeScraperLookup): AnimeScraperLookup {
  return {
    ...normalizeMediaLookupFacts(lookup),
    format: matchesAnimeFormat(lookup.format) ? lookup.format : undefined
  }
}

/** The facts that tell one entry of a work from another. */
export type AnimeLookupFacts = Pick<AnimeScraperLookup, 'releaseDate' | 'format'>

// =============================================================================
// Search
// =============================================================================

/** A single anime search result */
export interface AnimeSearchResult {
  id: string
  name: string
  originalName?: string
  releaseDate?: PartialDate
  format?: AnimeFormat
  externalIds: ExternalId[]
}

/**
 * Pick the search result an entry's own facts point at.
 *
 * A name search spans every entry of a work: one row per season, plus the
 * specials and the films. So the first row is right only by accident, and the
 * facts rank them instead — the format says which kind of entry to look for,
 * the release date says which one of that kind. Rows the facts cannot separate
 * keep the order the provider gave them, and specials rank last unless asked
 * for, so a caller that states no facts lands on the provider's first
 * non-special row.
 */
export function selectAnimeSearchResult<TResult extends AnimeLookupFacts>(
  results: readonly TResult[],
  facts: AnimeLookupFacts
): TResult | null {
  let best: TResult | null = null
  let bestRank = -1

  for (const result of results) {
    // Format outranks date: the kind of entry narrows harder than the year.
    const rank = rankAnimeFormat(result.format, facts.format) * 3 + rankReleaseYear(result, facts)
    if (rank > bestRank) {
      best = result
      bestRank = rank
    }
  }

  return best
}

function rankAnimeFormat(
  candidate: AnimeFormat | undefined,
  wanted: AnimeFormat | undefined
): number {
  if (wanted !== undefined && candidate === wanted) {
    return 2
  }

  // Specials are what a name search offers that a caller almost never means,
  // so they rank last unless they were asked for.
  return candidate === 'special' ? 0 : 1
}
