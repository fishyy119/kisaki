import type {
  AnimeScraperSession,
  AnimeScraperSlot,
  AnimeSessionResultMap,
  ScrapedEntityIdentity
} from '@kisaki3/extension-sdk'
import type { TmdbClient } from '../../api/client'
import { formatTmdbSubjectId, type TmdbSubjectRef } from '../../identity/subject-id'
import { TMDB_SOURCE_ID } from '../../utils/constants'
import { createMovieLoaders, createSeriesLoaders, type TmdbRequestContext } from '../loaders'
import { createMovieSource, createSeriesSource, type TmdbAnimeSlot } from './source'

/**
 * One scrape of one TMDB reference.
 *
 * The reference decides which readers answer the slots; the underlying reads
 * are memoized per session, so a profile asking for eight slots still fetches
 * each TMDB resource once.
 */
export function createTmdbAnimeSession(
  client: TmdbClient,
  ref: TmdbSubjectRef,
  ctx: TmdbRequestContext
): AnimeScraperSession {
  const source =
    ref.kind === 'movie'
      ? createMovieSource(createMovieLoaders(client, ref.movieId, ctx), ctx)
      : createSeriesSource(ref, createSeriesLoaders(client, ref.seriesId, ctx), ctx)

  const identity: ScrapedEntityIdentity = {
    externalIds: [{ source: TMDB_SOURCE_ID, id: formatTmdbSubjectId(ref) }]
  }
  const tasks = new Map<AnimeScraperSlot, Promise<unknown>>()

  return {
    get: async (slots) => {
      const output: Partial<AnimeSessionResultMap> = {}

      await Promise.all(
        slots.filter(isSupportedSlot).map(async (slot) => {
          if (!tasks.has(slot)) {
            tasks.set(slot, source[slot]())
          }

          const payload = await tasks.get(slot)!
          if (payload !== undefined) {
            ;(output as Record<AnimeScraperSlot, unknown>)[slot] = payload
          }
        })
      )

      return { identity, slots: output }
    }
  }
}

function isSupportedSlot(slot: AnimeScraperSlot): slot is TmdbAnimeSlot {
  return slot !== 'characters'
}
