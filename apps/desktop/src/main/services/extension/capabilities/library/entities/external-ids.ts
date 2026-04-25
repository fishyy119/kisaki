import type { ExternalId } from '@kisaki/extension-api'
import { eq, inArray } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { DbContext } from '@main/services/db'
import { normalizeExternalIds } from '@shared/identity'
import type { ExternalIdConfig } from './types'

export function loadExternalIds<TTable extends SQLiteTable>(
  db: DbContext,
  config: ExternalIdConfig<TTable>,
  entityIds: readonly string[]
): Map<string, readonly ExternalId[]> {
  const byEntity = new Map<string, ExternalId[]>()
  if (entityIds.length === 0) {
    return byEntity
  }

  const rows = db
    .select()
    .from(config.table)
    .where(inArray(config.entityIdColumn, [...entityIds]))
    .orderBy(config.orderColumn)
    .all()

  for (const row of rows) {
    const entityId = config.toEntityId(row)
    let list = byEntity.get(entityId)
    if (!list) {
      list = []
      byEntity.set(entityId, list)
    }

    list.push(config.toExternalId(row))
  }

  return byEntity
}

export function syncExternalIds<TTable extends SQLiteTable>(
  tx: DbContext,
  config: ExternalIdConfig<TTable>,
  entityId: string,
  externalIds: readonly ExternalId[] | undefined
): void {
  tx.delete(config.table).where(eq(config.entityIdColumn, entityId)).run()

  const normalized = normalizeExternalIds(
    externalIds?.map((externalId) => ({ source: externalId.source, id: externalId.id }))
  )

  for (const [index, entry] of normalized.entries()) {
    tx.insert(config.table)
      .values(config.buildInsertValue(entityId, entry, index))
      .run()
  }
}
