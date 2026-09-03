/**
 * Entity references derived from the schema.
 *
 * Answers, for every table, which entity kinds its rows point at and through
 * which columns. The answer is read from the Drizzle foreign keys (an entity
 * table's own `id` counts as pointing at itself), so it is complete by
 * construction: a table joins the attribution the moment its schema declares
 * the key. `media_relations` is the one polymorphic exception: its endpoints
 * carry the media type in a sibling column instead of a foreign key.
 *
 * Both processes use this module. The main process derives the targets it
 * attaches to every change summary from it; the renderer partitions a
 * resource's read tables into target-attributed and table-attributed ones
 * with the same function, so the two sides agree on what "attributable"
 * means without a hand-maintained routing table.
 */

import { getTableName, is } from 'drizzle-orm'
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core'
import { MEDIA_TYPES, type AllEntityType, type MediaType } from '../entity-types'
import type { DbChangeSummary, DbChangeTarget, RawDbChange } from './changes'
import * as tables from './schema/tables'
import type { TableName } from './table-names'

/** The table that owns each entity kind's rows. */
export const ENTITY_TABLE_BY_TYPE: Record<AllEntityType, SQLiteTable> = {
  game: tables.games,
  anime: tables.animes,
  comic: tables.comics,
  novel: tables.novels,
  character: tables.characters,
  person: tables.persons,
  company: tables.companies,
  collection: tables.collections,
  tag: tables.tags
}

const ENTITY_KIND_BY_TABLE_NAME = new Map<string, AllEntityType>(
  (Object.entries(ENTITY_TABLE_BY_TYPE) as Array<[AllEntityType, SQLiteTable]>).map(
    ([kind, table]) => [getTableName(table), kind]
  )
)

/** A column whose value is the id of an entity of a fixed kind. */
export interface EntityReferenceColumn {
  column: string
  entity: AllEntityType
}

/** A column whose value is an entity id, typed by a sibling column. */
export interface PolymorphicReferenceColumn {
  idColumn: string
  typeColumn: string
}

export interface TableEntityReferences {
  readonly columns: readonly EntityReferenceColumn[]
  readonly polymorphic: readonly PolymorphicReferenceColumn[]
}

const NO_REFERENCES: TableEntityReferences = { columns: [], polymorphic: [] }
const EMPTY_KINDS: ReadonlySet<AllEntityType> = new Set()

function collectReferences(table: SQLiteTable): TableEntityReferences {
  const config = getTableConfig(table)
  const columns: EntityReferenceColumn[] = []

  const ownKind = ENTITY_KIND_BY_TABLE_NAME.get(config.name)
  if (ownKind) {
    columns.push({ column: 'id', entity: ownKind })
  }

  for (const foreignKey of config.foreignKeys) {
    const reference = foreignKey.reference()
    const kind = ENTITY_KIND_BY_TABLE_NAME.get(getTableName(reference.foreignTable))
    if (!kind) continue
    for (const column of reference.columns) {
      columns.push({ column: column.name, entity: kind })
    }
  }

  const polymorphic: PolymorphicReferenceColumn[] =
    table === tables.mediaRelations
      ? [
          {
            idColumn: tables.mediaRelations.fromId.name,
            typeColumn: tables.mediaRelations.fromType.name
          },
          {
            idColumn: tables.mediaRelations.toId.name,
            typeColumn: tables.mediaRelations.toType.name
          }
        ]
      : []

  return { columns, polymorphic }
}

const REFERENCES_BY_TABLE: ReadonlyMap<string, TableEntityReferences> = new Map(
  (Object.values(tables) as unknown[])
    .filter((value): value is SQLiteTable => is(value, SQLiteTable))
    .map((table) => [getTableName(table), collectReferences(table)] as const)
)

const KINDS_BY_TABLE: ReadonlyMap<string, ReadonlySet<AllEntityType>> = new Map(
  [...REFERENCES_BY_TABLE.entries()].map(([name, references]) => {
    const kinds = new Set<AllEntityType>(references.columns.map((column) => column.entity))
    if (references.polymorphic.length > 0) {
      for (const mediaType of MEDIA_TYPES) kinds.add(mediaType)
    }
    return [name, kinds] as const
  })
)

/** Entity kind whose rows the table owns, when it is an entity table. */
export function entityKindOfTable(table: TableName): AllEntityType | undefined {
  return ENTITY_KIND_BY_TABLE_NAME.get(table)
}

/** Columns through which the table's rows reference entities. */
export function getTableEntityReferences(table: TableName): TableEntityReferences {
  return REFERENCES_BY_TABLE.get(table) ?? NO_REFERENCES
}

/** Entity kinds the table's rows can be attributed to; empty when none. */
export function referencedEntityKinds(table: TableName): ReadonlySet<AllEntityType> {
  return KINDS_BY_TABLE.get(table) ?? EMPTY_KINDS
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function mediaTypeValue(value: unknown): MediaType | undefined {
  return typeof value === 'string' && (MEDIA_TYPES as readonly string[]).includes(value)
    ? (value as MediaType)
    : undefined
}

/**
 * Entities a raw change is attributed to, from both the old and the new row:
 * a link that moved between owners invalidates both, a deleted row its old
 * owner, an inserted row its new one.
 */
export function deriveChangeTargets(change: RawDbChange): DbChangeTarget[] {
  const references = getTableEntityReferences(change.table)
  const rows = [change.old, change.next].filter(
    (row): row is Record<string, unknown> => row !== undefined
  )
  const seen = new Set<string>()
  const targets: DbChangeTarget[] = []

  const add = (entity: AllEntityType, id: string | undefined): void => {
    if (!id) return
    const key = `${entity}\u0000${id}`
    if (seen.has(key)) return
    seen.add(key)
    targets.push({ entity, id })
  }

  for (const row of rows) {
    for (const reference of references.columns) {
      add(reference.entity, stringValue(row[reference.column]))
    }
    for (const reference of references.polymorphic) {
      const entity = mediaTypeValue(row[reference.typeColumn])
      if (entity) add(entity, stringValue(row[reference.idColumn]))
    }
  }

  // The row's own id is the entity id for entity tables even when the trigger
  // delivered no snapshot; every other attribution needs the row values.
  const ownKind = ENTITY_KIND_BY_TABLE_NAME.get(change.table)
  if (ownKind) add(ownKind, change.id)

  return targets
}

/** The bounded renderer-facing projection of a raw change. */
export function summarizeDbChange(change: RawDbChange): DbChangeSummary {
  return {
    operation: change.operation,
    table: change.table,
    id: change.id,
    occurredAt: change.occurredAt,
    targets: deriveChangeTargets(change)
  }
}
