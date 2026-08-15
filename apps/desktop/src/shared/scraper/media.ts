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
