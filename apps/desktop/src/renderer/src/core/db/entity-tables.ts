/**
 * Entity table registry.
 *
 * Single holder of "which table, which columns" per entity type: the Drizzle
 * table, its SQL name (also the attachment folder), and the columns every
 * entity-generic path relies on.
 *
 * Values stay concrete table and column references instead of the wide
 * `SQLiteTable`, so shared write paths such as `db.update(def.table).set(...)`
 * type-check against exactly the columns the caller's entity union shares.
 * `satisfies` keeps that precision while still demanding one entry per entity
 * type, so a new entity type does not compile until it is listed here.
 */
import { getTableName, inArray } from 'drizzle-orm'
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'

import type { AllEntityType } from '@shared/common'
import type { TableName } from '@shared/db/table-names'
import { db } from './proxy'
import {
  animes,
  characters,
  collections,
  comics,
  companies,
  games,
  novels,
  persons,
  tags,
  type Anime,
  type Character,
  type Collection,
  type Comic,
  type Company,
  type Game,
  type Novel,
  type Person,
  type Tag
} from '@shared/db'

/** Row type per entity type for typed generic query results. */
export interface EntityRowMap {
  game: Game
  anime: Anime
  comic: Comic
  novel: Novel
  character: Character
  person: Person
  company: Company
  collection: Collection
  tag: Tag
}

interface EntityTableDef {
  table: SQLiteTable
  tableName: TableName
  idColumn: SQLiteColumn
  nameColumn: SQLiteColumn
  isNsfwColumn: SQLiteColumn
}

export const ENTITY_TABLES = {
  game: {
    table: games,
    tableName: getTableName(games),
    idColumn: games.id,
    nameColumn: games.name,
    isNsfwColumn: games.isNsfw
  },
  anime: {
    table: animes,
    tableName: getTableName(animes),
    idColumn: animes.id,
    nameColumn: animes.name,
    isNsfwColumn: animes.isNsfw
  },
  comic: {
    table: comics,
    tableName: getTableName(comics),
    idColumn: comics.id,
    nameColumn: comics.name,
    isNsfwColumn: comics.isNsfw
  },
  novel: {
    table: novels,
    tableName: getTableName(novels),
    idColumn: novels.id,
    nameColumn: novels.name,
    isNsfwColumn: novels.isNsfw
  },
  character: {
    table: characters,
    tableName: getTableName(characters),
    idColumn: characters.id,
    nameColumn: characters.name,
    isNsfwColumn: characters.isNsfw
  },
  person: {
    table: persons,
    tableName: getTableName(persons),
    idColumn: persons.id,
    nameColumn: persons.name,
    isNsfwColumn: persons.isNsfw
  },
  company: {
    table: companies,
    tableName: getTableName(companies),
    idColumn: companies.id,
    nameColumn: companies.name,
    isNsfwColumn: companies.isNsfw
  },
  collection: {
    table: collections,
    tableName: getTableName(collections),
    idColumn: collections.id,
    nameColumn: collections.name,
    isNsfwColumn: collections.isNsfw
  },
  tag: {
    table: tags,
    tableName: getTableName(tags),
    idColumn: tags.id,
    nameColumn: tags.name,
    isNsfwColumn: tags.isNsfw
  }
} as const satisfies Record<AllEntityType, EntityTableDef>

/**
 * Updates entity core rows through the registry.
 *
 * The one dynamic write seam for entity-generic dialogs and menus: the
 * direct-write guard cannot resolve a registry-driven table statically, so
 * those writes funnel through here, where the registry binds each entity type
 * to its concrete allowlisted table. The cast is this module's owned
 * correlation between the entity type and its patch shape.
 */
export async function updateEntityRows<T extends AllEntityType>(
  entityType: T,
  entityIds: readonly string[],
  patch: Partial<EntityRowMap[T]>
): Promise<void> {
  const def: EntityTableDef = ENTITY_TABLES[entityType]
  await db
    .update(def.table)
    .set(patch as never)
    .where(inArray(def.idColumn, [...entityIds]))
}
