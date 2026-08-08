/**
 * Batch row loading.
 *
 * Parameterized by schema facts only: which table holds the entity, which
 * columns carry its names, and which link table holds its external IDs. Rows
 * come back in request order, and ids without a row are dropped so the caller
 * can count them as skipped.
 */

import { inArray } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { AnySQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'
import type * as schema from '@shared/db/schema'
import type { ExternalIdLinkTable } from '@main/services/db'
import type { ExternalId } from '@shared/identity'
import type { IngestBatchUpdateRow } from './types'

export interface IngestBatchRowSource {
  table: SQLiteTable
  idColumn: AnySQLiteColumn
  nameColumn: AnySQLiteColumn
  originalNameColumn: AnySQLiteColumn
  externalIdLink: ExternalIdLinkTable
}

export function loadIngestBatchRows(
  db: BetterSQLite3Database<typeof schema>,
  source: IngestBatchRowSource,
  ids: string[]
): IngestBatchUpdateRow[] {
  const entityRows = db
    .select({
      id: source.idColumn,
      name: source.nameColumn,
      originalName: source.originalNameColumn
    })
    .from(source.table)
    .where(inArray(source.idColumn, ids))
    .all()

  const link = source.externalIdLink
  const externalIdRows = db
    .select({
      ownerId: link.entityIdColumn,
      source: link.sourceColumn,
      externalId: link.externalIdColumn
    })
    .from(link.table)
    .where(inArray(link.entityIdColumn, ids))
    .all()

  const externalIdsByOwner = new Map<string, ExternalId[]>()
  for (const row of externalIdRows) {
    const ownerId = String(row.ownerId)
    const list = externalIdsByOwner.get(ownerId) ?? []
    list.push({ source: String(row.source), id: String(row.externalId) })
    externalIdsByOwner.set(ownerId, list)
  }

  const rowById = new Map(entityRows.map((row) => [String(row.id), row] as const))
  return ids.flatMap((id) => {
    const row = rowById.get(id)
    if (!row) return []

    return [
      {
        id,
        name: String(row.name),
        originalName: typeof row.originalName === 'string' ? row.originalName : null,
        externalIds: externalIdsByOwner.get(id) ?? []
      }
    ]
  })
}
