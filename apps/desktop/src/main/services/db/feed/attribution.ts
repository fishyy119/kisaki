/**
 * Entity attribution of raw changes, derived from the schema.
 *
 * Answers which library entities a changed row belongs to, so the feed can
 * group `library.changed` per entity. The answer is read from the Drizzle
 * foreign keys (an entity table's own `id` counts as pointing at itself), so
 * it is complete by construction: a table joins the attribution the moment
 * its schema declares the key. `media_relations` is the one polymorphic
 * exception: its endpoints carry the media type in a sibling column instead
 * of a foreign key.
 */

import { getTableName, is } from 'drizzle-orm'
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core'
import { MEDIA_TYPES, type AllEntityType, type MediaType } from '@shared/entity-types'
import type { RawDbChange } from '@shared/db/changes'
import * as tables from '@shared/db/schema/tables'

/** An entity a changed row is attributed to. */
export interface ChangeTarget {
  entity: AllEntityType
  id: string
}

const ENTITY_TABLE_BY_TYPE: Record<AllEntityType, SQLiteTable> = {
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
interface EntityReferenceColumn {
  column: string
  entity: AllEntityType
}

/** A column whose value is an entity id, typed by a sibling column. */
interface PolymorphicReferenceColumn {
  idColumn: string
  typeColumn: string
}

interface TableEntityReferences {
  readonly columns: readonly EntityReferenceColumn[]
  readonly polymorphic: readonly PolymorphicReferenceColumn[]
}

const NO_REFERENCES: TableEntityReferences = { columns: [], polymorphic: [] }

function collectReferences(table: SQLiteTable): TableEntityReferences {
  const config = getTableConfig(table)
  const columns: EntityReferenceColumn[] = []

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
 * a link that moved between owners belongs to both, a deleted row to its old
 * owner, an inserted row to its new one. An entity table's row is attributed
 * to itself even when the trigger delivered no snapshot.
 */
export function deriveChangeTargets(change: RawDbChange): ChangeTarget[] {
  const references = REFERENCES_BY_TABLE.get(change.table) ?? NO_REFERENCES
  const rows = [change.old, change.next].filter(
    (row): row is Record<string, unknown> => row !== undefined
  )
  const seen = new Set<string>()
  const targets: ChangeTarget[] = []

  const add = (entity: AllEntityType, id: string | undefined): void => {
    if (!id) return
    const key = `${entity}\u0000${id}`
    if (seen.has(key)) return
    seen.add(key)
    targets.push({ entity, id })
  }

  const ownKind = ENTITY_KIND_BY_TABLE_NAME.get(change.table)
  if (ownKind) add(ownKind, change.id)

  for (const row of rows) {
    for (const reference of references.columns) {
      add(reference.entity, stringValue(row[reference.column]))
    }
    for (const reference of references.polymorphic) {
      const entity = mediaTypeValue(row[reference.typeColumn])
      if (entity) add(entity, stringValue(row[reference.idColumn]))
    }
  }

  return targets
}
