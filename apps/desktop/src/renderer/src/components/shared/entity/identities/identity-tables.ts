/**
 * External-id storage adapters per entity type.
 *
 * Every entity owns its own `<entity>_external_ids` table with entity-named
 * anchor/order columns, so each spec closes over its concrete table instead
 * of leaking column-name differences into the shared dialog.
 */

import { asc, eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import {
  animeExternalIds,
  characterExternalIds,
  companyExternalIds,
  gameExternalIds,
  personExternalIds
} from '@shared/db'
import type { ContentEntityType } from '@shared/common'

export interface ExternalIdRow {
  id: string
  source: string
  externalId: string
}

interface IdentityStore {
  list: (anchorId: string) => Promise<ExternalIdRow[]>
  /** Replaces the anchor's full external-id list, persisting array order. */
  replace: (anchorId: string, rows: ExternalIdRow[]) => Promise<void>
}

export const IDENTITY_STORES: Record<ContentEntityType, IdentityStore> = {
  game: {
    list: (anchorId) =>
      db
        .select({
          id: gameExternalIds.id,
          source: gameExternalIds.source,
          externalId: gameExternalIds.externalId
        })
        .from(gameExternalIds)
        .where(eq(gameExternalIds.gameId, anchorId))
        .orderBy(asc(gameExternalIds.orderInGame)),
    replace: async (anchorId, rows) => {
      await db.delete(gameExternalIds).where(eq(gameExternalIds.gameId, anchorId))
      if (rows.length > 0) {
        await db
          .insert(gameExternalIds)
          .values(rows.map((row, index) => ({ ...row, gameId: anchorId, orderInGame: index })))
      }
    }
  },
  anime: {
    list: (anchorId) =>
      db
        .select({
          id: animeExternalIds.id,
          source: animeExternalIds.source,
          externalId: animeExternalIds.externalId
        })
        .from(animeExternalIds)
        .where(eq(animeExternalIds.animeId, anchorId))
        .orderBy(asc(animeExternalIds.orderInAnime)),
    replace: async (anchorId, rows) => {
      await db.delete(animeExternalIds).where(eq(animeExternalIds.animeId, anchorId))
      if (rows.length > 0) {
        await db
          .insert(animeExternalIds)
          .values(rows.map((row, index) => ({ ...row, animeId: anchorId, orderInAnime: index })))
      }
    }
  },
  character: {
    list: (anchorId) =>
      db
        .select({
          id: characterExternalIds.id,
          source: characterExternalIds.source,
          externalId: characterExternalIds.externalId
        })
        .from(characterExternalIds)
        .where(eq(characterExternalIds.characterId, anchorId))
        .orderBy(asc(characterExternalIds.orderInCharacter)),
    replace: async (anchorId, rows) => {
      await db.delete(characterExternalIds).where(eq(characterExternalIds.characterId, anchorId))
      if (rows.length > 0) {
        await db.insert(characterExternalIds).values(
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
          id: personExternalIds.id,
          source: personExternalIds.source,
          externalId: personExternalIds.externalId
        })
        .from(personExternalIds)
        .where(eq(personExternalIds.personId, anchorId))
        .orderBy(asc(personExternalIds.orderInPerson)),
    replace: async (anchorId, rows) => {
      await db.delete(personExternalIds).where(eq(personExternalIds.personId, anchorId))
      if (rows.length > 0) {
        await db
          .insert(personExternalIds)
          .values(rows.map((row, index) => ({ ...row, personId: anchorId, orderInPerson: index })))
      }
    }
  },
  company: {
    list: (anchorId) =>
      db
        .select({
          id: companyExternalIds.id,
          source: companyExternalIds.source,
          externalId: companyExternalIds.externalId
        })
        .from(companyExternalIds)
        .where(eq(companyExternalIds.companyId, anchorId))
        .orderBy(asc(companyExternalIds.orderInCompany)),
    replace: async (anchorId, rows) => {
      await db.delete(companyExternalIds).where(eq(companyExternalIds.companyId, anchorId))
      if (rows.length > 0) {
        await db.insert(companyExternalIds).values(
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
