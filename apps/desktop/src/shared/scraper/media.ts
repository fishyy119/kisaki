/**
 * Media Scraper Types
 *
 * Definitions shared by every media type's scraper contract. Metadata entities
 * (person, company, character) are identified by different facts and do not
 * take part in these shapes.
 */

import type { PartialDate } from '@shared/db'
import { normalizePartialDate } from '@shared/db/columns/partial-date'
import type { ScraperLookup } from './slot'

/**
 * Media lookup carrying the facts the caller already knows about the entry.
 *
 * `knownIds` names the entry outright; the facts only disambiguate a name
 * search, where one work spans many provider entries. TMDB, for instance,
 * offers every season of a show plus its specials collection under the same
 * name, so a lookup without a TMDB id needs the entry's own release date to
 * pick the season it mirrors. Facts are hints, never overrides: a provider that
 * can identify the entry by id ignores them.
 */
export interface MediaScraperLookup extends ScraperLookup {
  /** Release date of the entry, as precise as the caller knows it. */
  releaseDate?: PartialDate
}

/**
 * Keep only the lookup facts stated in the shape the contract defines.
 *
 * Facts cross process boundaries as plain JSON, and an unreadable fact is worse
 * than a missing one: providers would rank their candidates against it. So a
 * value outside the contract is dropped rather than repaired.
 */
export function normalizeMediaLookupFacts<TLookup extends MediaScraperLookup>(
  lookup: TLookup
): TLookup {
  return {
    ...lookup,
    releaseDate: normalizePartialDate(lookup.releaseDate) ?? undefined
  }
}

/**
 * Layer a search result sits at, when the provider states one.
 *
 * Sources that publish a work and each of its volumes as separate searchable
 * entries return them side by side, and only the work is a library entry. The
 * fact is optional because a source with one grain has nothing to say here,
 * and a silent result must not read as a volume.
 */
export const MEDIA_ENTRY_GRAINS = ['work', 'volume'] as const

export type MediaEntryGrain = (typeof MEDIA_ENTRY_GRAINS)[number]

/**
 * Score a candidate's stated grain.
 *
 * A confirmed work outranks silence, which outranks a confirmed volume — the
 * same three-way shape as `rankReleaseYear`, because a provider that states no
 * grain is not evidence of either one.
 */
export function rankEntryGrain(grain: MediaEntryGrain | undefined): number {
  if (grain === undefined) return 1
  return grain === 'work' ? 2 : 0
}

/** The release-year facts a candidate and a lookup are compared on. */
interface ReleaseYearFacts {
  releaseDate?: PartialDate
}

/**
 * Score a candidate's release year against the wanted one.
 *
 * A year neither side states is no evidence, so it scores between a match and
 * a mismatch: an unknown year must not beat a confirmed one, nor lose to a
 * year that is known to be wrong. How this score weighs against the other
 * facts is each media type's own policy.
 */
export function rankReleaseYear(candidate: ReleaseYearFacts, wanted: ReleaseYearFacts): number {
  const wantedYear = wanted.releaseDate?.year
  const candidateYear = candidate.releaseDate?.year
  if (wantedYear === undefined || candidateYear === undefined) {
    return 1
  }

  return candidateYear === wantedYear ? 2 : 0
}
