import { eq } from 'drizzle-orm'
import type { DbService } from '@main/services/db'
import { comics } from '@shared/db'
import type { ComicUpdateRequest } from '@shared/ingest/update'
import type { ComicScraperLookup } from '@shared/scraper'
import { normalizeLookup } from '../../normalization'

/**
 * Complete the request's lookup with what the stored entry already knows.
 *
 * The caller states the facts of the result it picked, which is authoritative
 * when the update rebinds the entry. Whatever it leaves open falls back to the
 * entry's own row, so providers the entry has no id for can still tell one
 * edition of a work from the next.
 */
export function resolveComicUpdateLookup(
  dbService: DbService,
  request: ComicUpdateRequest
): ComicScraperLookup {
  const lookup = normalizeLookup(request.lookup)
  if (lookup.releaseDate && lookup.format) {
    return lookup
  }

  const stored = dbService.client
    .select({ releaseDate: comics.releaseDate, format: comics.format })
    .from(comics)
    .where(eq(comics.id, request.rootId))
    .get()

  return {
    ...lookup,
    releaseDate: lookup.releaseDate ?? stored?.releaseDate ?? undefined,
    format: lookup.format ?? stored?.format
  }
}
