import { eq } from 'drizzle-orm'
import type { DbService } from '@main/services/db'
import { games } from '@shared/db'
import type { GameUpdateRequest } from '@shared/ingest/update'
import type { GameScraperLookup } from '@shared/scraper'
import { normalizeLookup } from '../../normalization'

/**
 * Complete the request's lookup with what the stored entry already knows.
 *
 * The caller states the facts of the result it picked, which is authoritative
 * when the update rebinds the entry. Whatever it leaves open falls back to the
 * entry's own row, so providers the entry has no id for can still tell one
 * release of a title from the next.
 */
export function resolveGameUpdateLookup(
  dbService: DbService,
  request: GameUpdateRequest
): GameScraperLookup {
  const lookup = normalizeLookup(request.lookup)
  if (lookup.releaseDate) {
    return lookup
  }

  const stored = dbService.client
    .select({ releaseDate: games.releaseDate })
    .from(games)
    .where(eq(games.id, request.rootId))
    .get()

  return { ...lookup, releaseDate: stored?.releaseDate ?? undefined }
}
