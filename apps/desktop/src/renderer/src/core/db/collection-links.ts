/**
 * Collection link-table registry.
 *
 * Maps each content entity type to its collection link table, typed table
 * name, and the columns used for membership queries and inserts.
 */
import { asc, eq, getTableName } from 'drizzle-orm'
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'

import type { ContentEntityType } from '@shared/common'
import type { TableName } from '@shared/db/table-names'
import {
  collectionAnimeLinks,
  collectionCharacterLinks,
  collectionComicLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionNovelLinks,
  collectionPersonLinks
} from '@shared/db'
import { ENTITY_TABLES } from './entity-tables'
import { db } from './proxy'

/** A membership row to write, before it is named for its link table. */
export interface CollectionLinkRow {
  id: string
  collectionId: string
  entityId: string
  note: string | null
  orderInCollection: number
}

export interface CollectionLinkDef {
  table: SQLiteTable
  tableName: TableName
  idColumn: SQLiteColumn
  collectionIdColumn: SQLiteColumn
  entityIdColumn: SQLiteColumn
  noteColumn: SQLiteColumn
  orderColumn: SQLiteColumn
  /** Renames `entityId` to the table's own entity column. */
  buildInsertValue(row: CollectionLinkRow): Record<string, unknown>
}

export const COLLECTION_LINKS: Record<ContentEntityType, CollectionLinkDef> = {
  game: {
    table: collectionGameLinks,
    tableName: getTableName(collectionGameLinks),
    idColumn: collectionGameLinks.id,
    collectionIdColumn: collectionGameLinks.collectionId,
    entityIdColumn: collectionGameLinks.gameId,
    noteColumn: collectionGameLinks.note,
    orderColumn: collectionGameLinks.orderInCollection,
    buildInsertValue({ id, collectionId, entityId, note, orderInCollection }) {
      return { id, collectionId, gameId: entityId, note, orderInCollection }
    }
  },
  anime: {
    table: collectionAnimeLinks,
    tableName: getTableName(collectionAnimeLinks),
    idColumn: collectionAnimeLinks.id,
    collectionIdColumn: collectionAnimeLinks.collectionId,
    entityIdColumn: collectionAnimeLinks.animeId,
    noteColumn: collectionAnimeLinks.note,
    orderColumn: collectionAnimeLinks.orderInCollection,
    buildInsertValue({ id, collectionId, entityId, note, orderInCollection }) {
      return { id, collectionId, animeId: entityId, note, orderInCollection }
    }
  },
  comic: {
    table: collectionComicLinks,
    tableName: getTableName(collectionComicLinks),
    idColumn: collectionComicLinks.id,
    collectionIdColumn: collectionComicLinks.collectionId,
    entityIdColumn: collectionComicLinks.comicId,
    noteColumn: collectionComicLinks.note,
    orderColumn: collectionComicLinks.orderInCollection,
    buildInsertValue({ id, collectionId, entityId, note, orderInCollection }) {
      return { id, collectionId, comicId: entityId, note, orderInCollection }
    }
  },
  novel: {
    table: collectionNovelLinks,
    tableName: getTableName(collectionNovelLinks),
    idColumn: collectionNovelLinks.id,
    collectionIdColumn: collectionNovelLinks.collectionId,
    entityIdColumn: collectionNovelLinks.novelId,
    noteColumn: collectionNovelLinks.note,
    orderColumn: collectionNovelLinks.orderInCollection,
    buildInsertValue({ id, collectionId, entityId, note, orderInCollection }) {
      return { id, collectionId, novelId: entityId, note, orderInCollection }
    }
  },
  character: {
    table: collectionCharacterLinks,
    tableName: getTableName(collectionCharacterLinks),
    idColumn: collectionCharacterLinks.id,
    collectionIdColumn: collectionCharacterLinks.collectionId,
    entityIdColumn: collectionCharacterLinks.characterId,
    noteColumn: collectionCharacterLinks.note,
    orderColumn: collectionCharacterLinks.orderInCollection,
    buildInsertValue({ id, collectionId, entityId, note, orderInCollection }) {
      return { id, collectionId, characterId: entityId, note, orderInCollection }
    }
  },
  person: {
    table: collectionPersonLinks,
    tableName: getTableName(collectionPersonLinks),
    idColumn: collectionPersonLinks.id,
    collectionIdColumn: collectionPersonLinks.collectionId,
    entityIdColumn: collectionPersonLinks.personId,
    noteColumn: collectionPersonLinks.note,
    orderColumn: collectionPersonLinks.orderInCollection,
    buildInsertValue({ id, collectionId, entityId, note, orderInCollection }) {
      return { id, collectionId, personId: entityId, note, orderInCollection }
    }
  },
  company: {
    table: collectionCompanyLinks,
    tableName: getTableName(collectionCompanyLinks),
    idColumn: collectionCompanyLinks.id,
    collectionIdColumn: collectionCompanyLinks.collectionId,
    entityIdColumn: collectionCompanyLinks.companyId,
    noteColumn: collectionCompanyLinks.note,
    orderColumn: collectionCompanyLinks.orderInCollection,
    buildInsertValue({ id, collectionId, entityId, note, orderInCollection }) {
      return { id, collectionId, companyId: entityId, note, orderInCollection }
    }
  }
}

/** Inserts collection link rows through the registry (generic table glue). */
export async function insertCollectionLinks(
  entityType: ContentEntityType,
  rows: readonly CollectionLinkRow[]
): Promise<void> {
  if (rows.length === 0) return
  const def = COLLECTION_LINKS[entityType]
  await db.insert(def.table).values(rows.map((row) => def.buildInsertValue(row)) as never[])
}

/** Deletes every membership row of one collection for one entity type. */
export async function deleteCollectionLinks(
  entityType: ContentEntityType,
  collectionId: string
): Promise<void> {
  const def = COLLECTION_LINKS[entityType]
  await db.delete(def.table).where(eq(def.collectionIdColumn, collectionId))
}

/** A membership row read back, joined to its entity's display name. */
export interface CollectionMember {
  id: string
  entityId: string
  entityName: string | null
  note: string | null
  orderInCollection: number
}

/**
 * Reads one collection's members of a single entity type, in stored order.
 *
 * The registry columns are untyped `SQLiteColumn`, so the row shape is asserted
 * once here; this is the module's controlled unsafe point, as in `entity-query`.
 */
export async function queryCollectionMembers(
  entityType: ContentEntityType,
  collectionId: string
): Promise<CollectionMember[]> {
  const def = COLLECTION_LINKS[entityType]
  const entity = ENTITY_TABLES[entityType]

  const rows = await db
    .select({
      id: def.idColumn,
      entityId: def.entityIdColumn,
      entityName: entity.nameColumn,
      note: def.noteColumn,
      orderInCollection: def.orderColumn
    })
    .from(def.table)
    .leftJoin(entity.table, eq(def.entityIdColumn, entity.idColumn))
    .where(eq(def.collectionIdColumn, collectionId))
    .orderBy(asc(def.orderColumn))

  return rows as CollectionMember[]
}
