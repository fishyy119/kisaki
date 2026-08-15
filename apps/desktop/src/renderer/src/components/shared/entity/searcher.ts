import type { ScraperLookup } from '@shared/scraper'

/**
 * What an entity searcher reports upward.
 *
 * The searcher composes the lookup itself, because it alone knows which facts
 * its media type's providers can disambiguate on; the dialogs it feeds stay free
 * of per-entity knowledge. Until a row is picked, `lookup.name` carries the
 * typed query and may be empty, so a dialog that knows a better fallback name
 * replaces an empty one before submitting.
 *
 * The lookup must be plain data: dialogs forward it to the main process, and
 * IPC cannot clone a reactive proxy. Searchers therefore hold their results in
 * a `shallowRef`, and dialogs hold the selection in one.
 */
export interface EntitySearcherSelection<TLookup extends ScraperLookup = ScraperLookup> {
  profileId: string
  lookup: TLookup
  /** Whether a provider entry is picked and the searcher is ready to submit. */
  canSubmit: boolean
}
