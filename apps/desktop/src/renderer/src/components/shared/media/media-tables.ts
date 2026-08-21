/**
 * Media tables and per-media writers the media field dialogs use.
 *
 * Values stay concrete table references so shared-column reads type-check;
 * the status writer is a registry because the status enum differs per media
 * type and the caller's option list is the source of valid values.
 */

import { desc, eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import type { MediaType } from '@shared/common'
import {
  animeSessions,
  animes,
  gameSessions,
  games,
  type AnimeStatus,
  type GameStatus
} from '@shared/db'

export const MEDIA_TABLES = {
  game: games,
  anime: animes
} as const

/** Status writers keyed per media type; the option list guarantees the value. */
export const MEDIA_STATUS_WRITERS: Record<
  MediaType,
  (entityId: string, status: string) => Promise<void>
> = {
  game: async (entityId, status) => {
    await db
      .update(games)
      .set({ status: status as GameStatus })
      .where(eq(games.id, entityId))
  },
  anime: async (entityId, status) => {
    await db
      .update(animes)
      .set({ status: status as AnimeStatus })
      .where(eq(animes.id, entityId))
  }
}

export interface MediaSessionRow {
  id: string
  startedAt: Date
  endedAt: Date
}

/** Session storage adapters per media type; each closes over its own table. */
export interface MediaSessionStore {
  list: (anchorId: string) => Promise<MediaSessionRow[]>
  insert: (anchorId: string, data: { startedAt: Date; endedAt: Date }) => Promise<void>
  update: (id: string, data: { startedAt: Date; endedAt: Date }) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const MEDIA_SESSION_STORES: Record<MediaType, MediaSessionStore> = {
  game: {
    list: (anchorId) =>
      db
        .select({
          id: gameSessions.id,
          startedAt: gameSessions.startedAt,
          endedAt: gameSessions.endedAt
        })
        .from(gameSessions)
        .where(eq(gameSessions.gameId, anchorId))
        .orderBy(desc(gameSessions.startedAt)),
    insert: async (anchorId, data) => {
      await db.insert(gameSessions).values({ gameId: anchorId, ...data })
    },
    update: async (id, data) => {
      await db.update(gameSessions).set(data).where(eq(gameSessions.id, id))
    },
    remove: async (id) => {
      await db.delete(gameSessions).where(eq(gameSessions.id, id))
    }
  },
  anime: {
    list: (anchorId) =>
      db
        .select({
          id: animeSessions.id,
          startedAt: animeSessions.startedAt,
          endedAt: animeSessions.endedAt
        })
        .from(animeSessions)
        .where(eq(animeSessions.animeId, anchorId))
        .orderBy(desc(animeSessions.startedAt)),
    insert: async (anchorId, data) => {
      await db.insert(animeSessions).values({ animeId: anchorId, ...data })
    },
    update: async (id, data) => {
      await db.update(animeSessions).set(data).where(eq(animeSessions.id, id))
    },
    remove: async (id) => {
      await db.delete(animeSessions).where(eq(animeSessions.id, id))
    }
  }
}
