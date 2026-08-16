import type {
  MovieScraperSession,
  MovieScraperSlot,
  MovieSessionResultMap,
  ScrapedEntityIdentity
} from '@kisaki3/extension-sdk'
import type { TmdbClient } from '../../api/client'
import { formatTmdbSubjectId } from '../../identity/subject-id'
import { TMDB_SOURCE_ID } from '../../utils/constants'
import { createMovieLoaders, type TmdbRequestContext } from '../loaders'
import type { TmdbMovieRef } from './reference'
import { createMovieSource, type TmdbMovieSlot } from './source'

/**
 * One scrape of one TMDB film.
 *
 * The underlying reads are memoized per session, so a profile asking for every
 * slot still fetches each TMDB resource once.
 */
export function createTmdbMovieSession(
  client: TmdbClient,
  ref: TmdbMovieRef,
  ctx: TmdbRequestContext
): MovieScraperSession {
  const source = createMovieSource(createMovieLoaders(client, ref.movieId, ctx), ctx)
  const identity: ScrapedEntityIdentity = {
    externalIds: [{ source: TMDB_SOURCE_ID, id: formatTmdbSubjectId(ref) }]
  }
  const tasks = new Map<MovieScraperSlot, Promise<unknown>>()

  return {
    get: async (slots) => {
      const output: Partial<MovieSessionResultMap> = {}

      await Promise.all(
        slots.filter(isSupportedSlot).map(async (slot) => {
          if (!tasks.has(slot)) {
            tasks.set(slot, source[slot]())
          }

          const payload = await tasks.get(slot)!
          if (payload !== undefined) {
            ;(output as Record<MovieScraperSlot, unknown>)[slot] = payload
          }
        })
      )

      return { identity, slots: output }
    }
  }
}

function isSupportedSlot(slot: MovieScraperSlot): slot is TmdbMovieSlot {
  return slot !== 'characters'
}
