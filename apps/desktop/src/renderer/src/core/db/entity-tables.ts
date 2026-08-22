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
import { getTableName } from 'drizzle-orm'
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'

import type { AllEntityType } from '@shared/common'
import type { TableName } from '@shared/db/table-names'
import {
  animes,
  characters,
  collections,
  companies,
  games,
  persons,
  tags,
  type Anime,
  type Character,
  type Collection,
  type Company,
  type Game,
  type Person,
  type Tag
} from '@shared/db'

/** Row type per entity type for typed generic query results. */
export interface EntityRowMap {
  game: Game
  anime: Anime
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
