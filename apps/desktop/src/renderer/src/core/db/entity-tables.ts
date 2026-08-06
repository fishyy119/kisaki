/**
 * Entity table registry.
 *
 * Maps every entity type to its Drizzle table and the columns shared query
 * paths rely on (id, name, isNsfw). Single source for entity-generic queries.
 */
import { getTableName } from 'drizzle-orm'
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'

import type { AllEntityType } from '@shared/common'
import type { TableName } from '@shared/db/table-names'
import {
  characters,
  collections,
  companies,
  games,
  persons,
  tags,
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
  character: Character
  person: Person
  company: Company
  collection: Collection
  tag: Tag
}

export interface EntityTableDef {
  table: SQLiteTable
  tableName: TableName
  idColumn: SQLiteColumn
  nameColumn: SQLiteColumn
  isNsfwColumn: SQLiteColumn
}

export const ENTITY_TABLES: Record<AllEntityType, EntityTableDef> = {
  game: {
    table: games,
    tableName: getTableName(games),
    idColumn: games.id,
    nameColumn: games.name,
    isNsfwColumn: games.isNsfw
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
}
