/**
 * Per-media note storage adapters the shared notes components use.
 *
 * Each store closes over its own table so the media difference stays a
 * registry key; rows are normalized to `MediaNoteRow` with the per-media
 * order column exposed as `order`.
 */

import { eq } from 'drizzle-orm'
import { newId } from '@shared/id'
import { attachment, db } from '@renderer/core/db'
import type { MediaType } from '@shared/entity-types'
import { animeNotes, comicNotes, gameNotes, novelNotes } from '@shared/db'

/** Media-neutral note row consumed by the shared notes components. */
export interface MediaNoteRow {
  id: string
  name: string
  content: string | null
  coverFile: string | null
  order: number
  createdAt: Date
  updatedAt: Date
}

export interface MediaNoteStore {
  /** SQL table name for attachment URLs and db-change filters. */
  tableName: string
  find: (id: string) => Promise<MediaNoteRow | undefined>
  /** Inserts a note under the owning media entry and returns the new id. */
  create: (
    anchorId: string,
    data: { name: string; content: string | null; order: number }
  ) => Promise<string>
  update: (id: string, data: { name: string; content: string | null }) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Reorder writes leave `updatedAt` alone; ordering is not a content edit. */
  setOrder: (id: string, order: number) => Promise<void>
  setCover: (id: string, sourcePath: string) => Promise<void>
  clearCover: (id: string) => Promise<void>
}

export const MEDIA_NOTE_STORES: Record<MediaType, MediaNoteStore> = {
  game: {
    tableName: 'game_notes',
    find: async (id) => {
      const rows = await db
        .select({
          id: gameNotes.id,
          name: gameNotes.name,
          content: gameNotes.content,
          coverFile: gameNotes.coverFile,
          order: gameNotes.orderInGame,
          createdAt: gameNotes.createdAt,
          updatedAt: gameNotes.updatedAt
        })
        .from(gameNotes)
        .where(eq(gameNotes.id, id))
        .limit(1)
      return rows[0]
    },
    create: async (anchorId, data) => {
      const id = newId()
      await db.insert(gameNotes).values({
        id,
        gameId: anchorId,
        name: data.name,
        content: data.content,
        orderInGame: data.order
      })
      return id
    },
    update: async (id, data) => {
      await db
        .update(gameNotes)
        .set({ name: data.name, content: data.content, updatedAt: new Date() })
        .where(eq(gameNotes.id, id))
    },
    remove: async (id) => {
      await db.delete(gameNotes).where(eq(gameNotes.id, id))
    },
    setOrder: async (id, order) => {
      await db.update(gameNotes).set({ orderInGame: order }).where(eq(gameNotes.id, id))
    },
    setCover: async (id, sourcePath) => {
      await attachment.setFile(gameNotes, id, 'coverFile', { kind: 'path', path: sourcePath })
    },
    clearCover: async (id) => {
      await attachment.clearFile(gameNotes, id, 'coverFile')
    }
  },
  anime: {
    tableName: 'anime_notes',
    find: async (id) => {
      const rows = await db
        .select({
          id: animeNotes.id,
          name: animeNotes.name,
          content: animeNotes.content,
          coverFile: animeNotes.coverFile,
          order: animeNotes.orderInAnime,
          createdAt: animeNotes.createdAt,
          updatedAt: animeNotes.updatedAt
        })
        .from(animeNotes)
        .where(eq(animeNotes.id, id))
        .limit(1)
      return rows[0]
    },
    create: async (anchorId, data) => {
      const id = newId()
      await db.insert(animeNotes).values({
        id,
        animeId: anchorId,
        name: data.name,
        content: data.content,
        orderInAnime: data.order
      })
      return id
    },
    update: async (id, data) => {
      await db
        .update(animeNotes)
        .set({ name: data.name, content: data.content, updatedAt: new Date() })
        .where(eq(animeNotes.id, id))
    },
    remove: async (id) => {
      await db.delete(animeNotes).where(eq(animeNotes.id, id))
    },
    setOrder: async (id, order) => {
      await db.update(animeNotes).set({ orderInAnime: order }).where(eq(animeNotes.id, id))
    },
    setCover: async (id, sourcePath) => {
      await attachment.setFile(animeNotes, id, 'coverFile', { kind: 'path', path: sourcePath })
    },
    clearCover: async (id) => {
      await attachment.clearFile(animeNotes, id, 'coverFile')
    }
  },
  comic: {
    tableName: 'comic_notes',
    find: async (id) => {
      const rows = await db
        .select({
          id: comicNotes.id,
          name: comicNotes.name,
          content: comicNotes.content,
          coverFile: comicNotes.coverFile,
          order: comicNotes.orderInComic,
          createdAt: comicNotes.createdAt,
          updatedAt: comicNotes.updatedAt
        })
        .from(comicNotes)
        .where(eq(comicNotes.id, id))
        .limit(1)
      return rows[0]
    },
    create: async (anchorId, data) => {
      const id = newId()
      await db.insert(comicNotes).values({
        id,
        comicId: anchorId,
        name: data.name,
        content: data.content,
        orderInComic: data.order
      })
      return id
    },
    update: async (id, data) => {
      await db
        .update(comicNotes)
        .set({ name: data.name, content: data.content, updatedAt: new Date() })
        .where(eq(comicNotes.id, id))
    },
    remove: async (id) => {
      await db.delete(comicNotes).where(eq(comicNotes.id, id))
    },
    setOrder: async (id, order) => {
      await db.update(comicNotes).set({ orderInComic: order }).where(eq(comicNotes.id, id))
    },
    setCover: async (id, sourcePath) => {
      await attachment.setFile(comicNotes, id, 'coverFile', { kind: 'path', path: sourcePath })
    },
    clearCover: async (id) => {
      await attachment.clearFile(comicNotes, id, 'coverFile')
    }
  },
  novel: {
    tableName: 'novel_notes',
    find: async (id) => {
      const rows = await db
        .select({
          id: novelNotes.id,
          name: novelNotes.name,
          content: novelNotes.content,
          coverFile: novelNotes.coverFile,
          order: novelNotes.orderInNovel,
          createdAt: novelNotes.createdAt,
          updatedAt: novelNotes.updatedAt
        })
        .from(novelNotes)
        .where(eq(novelNotes.id, id))
        .limit(1)
      return rows[0]
    },
    create: async (anchorId, data) => {
      const id = newId()
      await db.insert(novelNotes).values({
        id,
        novelId: anchorId,
        name: data.name,
        content: data.content,
        orderInNovel: data.order
      })
      return id
    },
    update: async (id, data) => {
      await db
        .update(novelNotes)
        .set({ name: data.name, content: data.content, updatedAt: new Date() })
        .where(eq(novelNotes.id, id))
    },
    remove: async (id) => {
      await db.delete(novelNotes).where(eq(novelNotes.id, id))
    },
    setOrder: async (id, order) => {
      await db.update(novelNotes).set({ orderInNovel: order }).where(eq(novelNotes.id, id))
    },
    setCover: async (id, sourcePath) => {
      await attachment.setFile(novelNotes, id, 'coverFile', { kind: 'path', path: sourcePath })
    },
    clearCover: async (id) => {
      await attachment.clearFile(novelNotes, id, 'coverFile')
    }
  }
}
