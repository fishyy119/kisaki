/**
 * Movie Scraper Types
 *
 * Type definitions for movie scraper providers, handlers, and operations.
 * This file contains only movie-specific types.
 */

import { MOVIE_FORMAT_VALUES, type MovieFormat, type PartialDate } from '@shared/db'
import type { ExternalId } from '@shared/identity'
import { normalizeMediaLookupFacts, rankReleaseYear, type MediaScraperLookup } from './media'
import type { ScraperCapability } from './slot'

// =============================================================================
// Provider Info
// =============================================================================

/** Information about a registered movie scraper provider */
export interface MovieScraperProviderInfo {
  id: string
  name: string
  externalIdSource: string
  capabilities: ScraperCapability[]
}

// =============================================================================
// Lookup
// =============================================================================

/**
 * Movie lookup, adding the release format to the shared media facts.
 *
 * The format separates the theatrical feature from the documentary and the
 * short that a franchise name can also return.
 */
export interface MovieScraperLookup extends MediaScraperLookup {
  /** Release format of the entry. */
  format?: MovieFormat
}

function matchesMovieFormat(value: unknown): value is MovieFormat {
  return (MOVIE_FORMAT_VALUES as readonly unknown[]).includes(value)
}

/** Keep only the lookup facts stated in the shape the contract defines. */
export function normalizeMovieLookupFacts(lookup: MovieScraperLookup): MovieScraperLookup {
  return {
    ...normalizeMediaLookupFacts(lookup),
    format: matchesMovieFormat(lookup.format) ? lookup.format : undefined
  }
}

/** The facts that tell one film from another. */
export type MovieLookupFacts = Pick<MovieScraperLookup, 'releaseDate' | 'format'>

// =============================================================================
// Search
// =============================================================================

/** A single movie search result */
export interface MovieSearchResult {
  id: string
  name: string
  originalName?: string
  releaseDate?: PartialDate
  format?: MovieFormat
  externalIds: ExternalId[]
}

/**
 * Pick the search result a film's own facts point at.
 *
 * A franchise name returns every entry in the series plus remakes sharing the
 * title, so the release year does most of the work here and the format breaks
 * the remaining ties. Rows the facts cannot separate keep the order the
 * provider gave them, so a caller that states no facts lands on the provider's
 * first row.
 */
export function selectMovieSearchResult<TResult extends MovieLookupFacts>(
  results: readonly TResult[],
  facts: MovieLookupFacts
): TResult | null {
  let best: TResult | null = null
  let bestRank = -1

  for (const result of results) {
    // Date outranks format: entries of a film series differ by year, not kind.
    const rank = rankReleaseYear(result, facts) * 3 + rankMovieFormat(result.format, facts.format)
    if (rank > bestRank) {
      best = result
      bestRank = rank
    }
  }

  return best
}

function rankMovieFormat(
  candidate: MovieFormat | undefined,
  wanted: MovieFormat | undefined
): number {
  return wanted !== undefined && candidate === wanted ? 2 : 1
}
