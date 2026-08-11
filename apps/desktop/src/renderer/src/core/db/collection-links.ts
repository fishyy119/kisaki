/**
 * Collection link-table registry.
 *
 * Maps each content entity type to its collection link table, typed table
 * name, and the columns used for membership queries and inserts.
 */
import { getTableName } from 'drizzle-orm'
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'

import type { ContentEntityType } from '@shared/common'
import type { TableName } from '@shared/db/table-names'
import {
  collectionAnimeLinks,
  collectionCharacterLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionPersonLinks
} from '@shared/db'
import { db } from './proxy'

export interface CollectionLinkDef {
  table: SQLiteTable
  tableName: TableName
  collectionIdColumn: SQLiteColumn
  entityIdColumn: SQLiteColumn
  orderColumn: SQLiteColumn
  buildInsertValue(
    id: string,
    collectionId: string,
    entityId: string,
    orderInCollection: number
  ): Record<string, unknown>
}

export const COLLECTION_LINKS: Record<ContentEntityType, CollectionLinkDef> = {
  game: {
    table: collectionGameLinks,
    tableName: getTableName(collectionGameLinks),
    collectionIdColumn: collectionGameLinks.collectionId,
    entityIdColumn: collectionGameLinks.gameId,
    orderColumn: collectionGameLinks.orderInCollection,
    buildInsertValue(id, collectionId, entityId, orderInCollection) {
      return { id, collectionId, gameId: entityId, orderInCollection }
    }
  },
  anime: {
    table: collectionAnimeLinks,
    tableName: getTableName(collectionAnimeLinks),
    collectionIdColumn: collectionAnimeLinks.collectionId,
    entityIdColumn: collectionAnimeLinks.animeId,
    orderColumn: collectionAnimeLinks.orderInCollection,
    buildInsertValue(id, collectionId, entityId, orderInCollection) {
      return { id, collectionId, animeId: entityId, orderInCollection }
    }
  },
  character: {
    table: collectionCharacterLinks,
    tableName: getTableName(collectionCharacterLinks),
    collectionIdColumn: collectionCharacterLinks.collectionId,
    entityIdColumn: collectionCharacterLinks.characterId,
    orderColumn: collectionCharacterLinks.orderInCollection,
    buildInsertValue(id, collectionId, entityId, orderInCollection) {
      return { id, collectionId, characterId: entityId, orderInCollection }
    }
  },
  person: {
    table: collectionPersonLinks,
    tableName: getTableName(collectionPersonLinks),
    collectionIdColumn: collectionPersonLinks.collectionId,
    entityIdColumn: collectionPersonLinks.personId,
    orderColumn: collectionPersonLinks.orderInCollection,
    buildInsertValue(id, collectionId, entityId, orderInCollection) {
      return { id, collectionId, personId: entityId, orderInCollection }
    }
  },
  company: {
    table: collectionCompanyLinks,
    tableName: getTableName(collectionCompanyLinks),
    collectionIdColumn: collectionCompanyLinks.collectionId,
    entityIdColumn: collectionCompanyLinks.companyId,
    orderColumn: collectionCompanyLinks.orderInCollection,
    buildInsertValue(id, collectionId, entityId, orderInCollection) {
      return { id, collectionId, companyId: entityId, orderInCollection }
    }
  }
}

/** Inserts collection link rows through the registry (generic table glue). */
export async function insertCollectionLinks(
  entityType: ContentEntityType,
  rows: readonly { id: string; collectionId: string; entityId: string; orderInCollection: number }[]
): Promise<void> {
  if (rows.length === 0) return
  const def = COLLECTION_LINKS[entityType]
  const values = rows.map((row) =>
    def.buildInsertValue(row.id, row.collectionId, row.entityId, row.orderInCollection)
  )
  await db.insert(def.table).values(values as never[])
}
