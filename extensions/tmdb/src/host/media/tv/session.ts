import type {
  ScrapedEntityIdentity,
  TvScraperSession,
  TvScraperSlot,
  TvSessionResultMap
} from '@kisaki3/extension-sdk'
import type { TmdbClient } from '../../api/client'
import { formatTmdbSubjectId } from '../../identity/subject-id'
import { TMDB_SOURCE_ID } from '../../utils/constants'
import { createSeriesLoaders, type TmdbRequestContext } from '../loaders'
import { createTvSource, type TmdbTvSlot } from './source'
import type { TmdbSeriesRef } from './reference'

/**
 * One scrape of one TMDB show.
 *
 * The underlying reads are memoized per session, so a profile asking for every
 * slot still fetches each TMDB resource once.
 */
export function createTmdbTvSession(
  client: TmdbClient,
  ref: TmdbSeriesRef,
  ctx: TmdbRequestContext
): TvScraperSession {
  const source = createTvSource(ref, createSeriesLoaders(client, ref.seriesId, ctx), ctx)
  const identity: ScrapedEntityIdentity = {
    externalIds: [{ source: TMDB_SOURCE_ID, id: formatTmdbSubjectId(ref) }]
  }
  const tasks = new Map<TvScraperSlot, Promise<unknown>>()

  return {
    get: async (slots) => {
      const output: Partial<TvSessionResultMap> = {}

      await Promise.all(
        slots.filter(isSupportedSlot).map(async (slot) => {
          if (!tasks.has(slot)) {
            tasks.set(slot, source[slot]())
          }

          const payload = await tasks.get(slot)!
          if (payload !== undefined) {
            ;(output as Record<TvScraperSlot, unknown>)[slot] = payload
          }
        })
      )

      return { identity, slots: output }
    }
  }
}

function isSupportedSlot(slot: TvScraperSlot): slot is TmdbTvSlot {
  return slot !== 'characters' && slot !== 'relatedEntries'
}
