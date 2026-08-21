/**
 * Tag-link storage adapters per entity type.
 *
 * Every entity owns its own `<entity>_tag_links` table with entity-named
 * anchor/order columns, so each spec closes over its concrete table instead
 * of leaking column-name differences into the shared dialog.
 */

import { asc, eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import {
  animeTagLinks,
  characterTagLinks,
  companyTagLinks,
  gameTagLinks,
  personTagLinks,
  tags
} from '@shared/db'
import type { TableEntityType } from '../entity-tables'

export interface TagLinkRow {
  id: string
  tagId: string
  tagName: string
  note: string | null
  isSpoiler: boolean
}

interface TagLinkStore {
  list: (anchorId: string) => Promise<TagLinkRow[]>
  /** Replaces the anchor's full tag-link list, persisting array order. */
  replace: (
    anchorId: string,
    rows: { id: string; tagId: string; note: string | null; isSpoiler: boolean }[]
  ) => Promise<void>
}

export const TAG_LINK_STORES: Record<TableEntityType, TagLinkStore> = {
  game: {
    list: (anchorId) =>
      db
        .select({
          id: gameTagLinks.id,
          tagId: gameTagLinks.tagId,
          tagName: tags.name,
          note: gameTagLinks.note,
          isSpoiler: gameTagLinks.isSpoiler
        })
        .from(gameTagLinks)
        .innerJoin(tags, eq(gameTagLinks.tagId, tags.id))
        .where(eq(gameTagLinks.gameId, anchorId))
        .orderBy(asc(gameTagLinks.orderInGame)),
    replace: async (anchorId, rows) => {
      await db.delete(gameTagLinks).where(eq(gameTagLinks.gameId, anchorId))
      if (rows.length > 0) {
        await db
          .insert(gameTagLinks)
          .values(rows.map((row, index) => ({ ...row, gameId: anchorId, orderInGame: index })))
      }
    }
  },
  anime: {
    list: (anchorId) =>
      db
        .select({
          id: animeTagLinks.id,
          tagId: animeTagLinks.tagId,
          tagName: tags.name,
          note: animeTagLinks.note,
          isSpoiler: animeTagLinks.isSpoiler
        })
        .from(animeTagLinks)
        .innerJoin(tags, eq(animeTagLinks.tagId, tags.id))
        .where(eq(animeTagLinks.animeId, anchorId))
        .orderBy(asc(animeTagLinks.orderInAnime)),
    replace: async (anchorId, rows) => {
      await db.delete(animeTagLinks).where(eq(animeTagLinks.animeId, anchorId))
      if (rows.length > 0) {
        await db
          .insert(animeTagLinks)
          .values(rows.map((row, index) => ({ ...row, animeId: anchorId, orderInAnime: index })))
      }
    }
  },
  character: {
    list: (anchorId) =>
      db
        .select({
          id: characterTagLinks.id,
          tagId: characterTagLinks.tagId,
          tagName: tags.name,
          note: characterTagLinks.note,
          isSpoiler: characterTagLinks.isSpoiler
        })
        .from(characterTagLinks)
        .innerJoin(tags, eq(characterTagLinks.tagId, tags.id))
        .where(eq(characterTagLinks.characterId, anchorId))
        .orderBy(asc(characterTagLinks.orderInCharacter)),
    replace: async (anchorId, rows) => {
      await db.delete(characterTagLinks).where(eq(characterTagLinks.characterId, anchorId))
      if (rows.length > 0) {
        await db.insert(characterTagLinks).values(
          rows.map((row, index) => ({
            ...row,
            characterId: anchorId,
            orderInCharacter: index
          }))
        )
      }
    }
  },
  person: {
    list: (anchorId) =>
      db
        .select({
          id: personTagLinks.id,
          tagId: personTagLinks.tagId,
          tagName: tags.name,
          note: personTagLinks.note,
          isSpoiler: personTagLinks.isSpoiler
        })
        .from(personTagLinks)
        .innerJoin(tags, eq(personTagLinks.tagId, tags.id))
        .where(eq(personTagLinks.personId, anchorId))
        .orderBy(asc(personTagLinks.orderInPerson)),
    replace: async (anchorId, rows) => {
      await db.delete(personTagLinks).where(eq(personTagLinks.personId, anchorId))
      if (rows.length > 0) {
        await db
          .insert(personTagLinks)
          .values(rows.map((row, index) => ({ ...row, personId: anchorId, orderInPerson: index })))
      }
    }
  },
  company: {
    list: (anchorId) =>
      db
        .select({
          id: companyTagLinks.id,
          tagId: companyTagLinks.tagId,
          tagName: tags.name,
          note: companyTagLinks.note,
          isSpoiler: companyTagLinks.isSpoiler
        })
        .from(companyTagLinks)
        .innerJoin(tags, eq(companyTagLinks.tagId, tags.id))
        .where(eq(companyTagLinks.companyId, anchorId))
        .orderBy(asc(companyTagLinks.orderInCompany)),
    replace: async (anchorId, rows) => {
      await db.delete(companyTagLinks).where(eq(companyTagLinks.companyId, anchorId))
      if (rows.length > 0) {
        await db.insert(companyTagLinks).values(
          rows.map((row, index) => ({
            ...row,
            companyId: anchorId,
            orderInCompany: index
          }))
        )
      }
    }
  }
}
