/**
 * Media tables and per-media writers the media field dialogs use.
 *
 * Values stay concrete table references so shared-column reads type-check;
 * the status writer is a registry because each write targets its own table.
 */

import { desc, eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import type { MediaType } from '@shared/common'
import {
  animeSessions,
  animes,
  comicSessions,
  comics,
  gameSessions,
  games,
  novelSessions,
  novels,
  type MediaStatus
} from '@shared/db'

export const MEDIA_TABLES = {
  game: games,
  anime: animes,
  comic: comics,
  novel: novels
} as const

/** Status writers keyed per media type; the status vocabulary is shared. */
export const MEDIA_STATUS_WRITERS: Record<
  MediaType,
  (entityId: string, status: MediaStatus) => Promise<void>
> = {
  game: async (entityId, status) => {
    await db.update(games).set({ status }).where(eq(games.id, entityId))
  },
  anime: async (entityId, status) => {
    await db.update(animes).set({ status }).where(eq(animes.id, entityId))
  },
  comic: async (entityId, status) => {
    await db.update(comics).set({ status }).where(eq(comics.id, entityId))
  },
  novel: async (entityId, status) => {
    await db.update(novels).set({ status }).where(eq(novels.id, entityId))
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
  },
  comic: {
    list: (anchorId) =>
      db
        .select({
          id: comicSessions.id,
          startedAt: comicSessions.startedAt,
          endedAt: comicSessions.endedAt
        })
        .from(comicSessions)
        .where(eq(comicSessions.comicId, anchorId))
        .orderBy(desc(comicSessions.startedAt)),
    insert: async (anchorId, data) => {
      await db.insert(comicSessions).values({ comicId: anchorId, ...data })
    },
    update: async (id, data) => {
      await db.update(comicSessions).set(data).where(eq(comicSessions.id, id))
    },
    remove: async (id) => {
      await db.delete(comicSessions).where(eq(comicSessions.id, id))
    }
  },
  novel: {
    list: (anchorId) =>
      db
        .select({
          id: novelSessions.id,
          startedAt: novelSessions.startedAt,
          endedAt: novelSessions.endedAt
        })
        .from(novelSessions)
        .where(eq(novelSessions.novelId, anchorId))
        .orderBy(desc(novelSessions.startedAt)),
    insert: async (anchorId, data) => {
      await db.insert(novelSessions).values({ novelId: anchorId, ...data })
    },
    update: async (id, data) => {
      await db.update(novelSessions).set(data).where(eq(novelSessions.id, id))
    },
    remove: async (id) => {
      await db.delete(novelSessions).where(eq(novelSessions.id, id))
    }
  }
}
