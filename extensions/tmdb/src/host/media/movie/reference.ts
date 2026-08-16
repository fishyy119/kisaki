import { parseTmdbRef, type TmdbMovieRef } from '../../identity/subject-id'

export type { TmdbMovieRef }

/**
 * The film a query or a stored id names.
 *
 * A bare number is read as a film here, mirroring what the media type is: the
 * same number means a show to the tv provider, and each provider only ever
 * reads ids of its own kind.
 */
export function readTmdbMovieRef(value: string): TmdbMovieRef | null {
  const input = value.trim()
  const bareId = /^(\d+)$/.exec(input)
  if (bareId) {
    return { kind: 'movie', movieId: Number(bareId[1]) }
  }

  const ref = parseTmdbRef(input)
  return ref?.kind === 'movie' ? ref : null
}
