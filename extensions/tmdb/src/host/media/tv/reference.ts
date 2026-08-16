import { parseTmdbRef, readTmdbSeriesId, type TmdbSeriesRef } from '../../identity/subject-id'

export type { TmdbSeriesRef }

/**
 * The show a query or a stored id names.
 *
 * A Kisaki series entry is a whole TMDB show, so anything that names a show
 * resolves to it: the canonical `tv:{id}`, a bare number, or a themoviedb.org
 * link — including a link to one of its seasons or episode groups, which names
 * the show it belongs to. An episode group id on its own names no show without
 * a lookup, so it is refused.
 */
export function readTmdbSeriesRef(value: string): TmdbSeriesRef | null {
  const input = value.trim()
  const bareId = /^(\d+)$/.exec(input)
  if (bareId) {
    return { kind: 'series', seriesId: Number(bareId[1]) }
  }

  const ref = parseTmdbRef(input)
  if (!ref) {
    return null
  }

  const seriesId = readTmdbSeriesId(ref)
  return seriesId === null ? null : { kind: 'series', seriesId }
}
