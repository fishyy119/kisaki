import { eq } from 'drizzle-orm'
import type { AllEntityType } from '@shared/common'
import { collections, showcaseSections } from '@shared/db'
import type { DynamicCollectionConfig } from '@shared/db/contracts/json'
import type { FilterCondition, FilterState } from '@shared/filter/model'
import { isRelationCondition } from '@shared/filter/model'
import { getFilterQuerySpec } from '@shared/filter/specs/registry'
import type { DbContext } from '../../types'

/**
 * Rewrites merged-away entity ids inside persisted filters (showcase sections
 * and dynamic collection configs). Relation targets are derived from the
 * entity's filter query spec.
 */
export function rewriteMergeFilters(
  db: DbContext,
  entityType: AllEntityType,
  targetId: string,
  sourceId: string,
  now: Date
): number {
  let changed = 0

  // DbContext is a db/transaction union whose field-projection select overloads
  // do not unify; select full rows instead.
  const sectionRows = db.select().from(showcaseSections).all()

  for (const row of sectionRows) {
    const nextFilter = rewriteFilterState(
      row.entityType,
      row.filter,
      entityType,
      targetId,
      sourceId
    )
    if (nextFilter === row.filter) continue

    db.update(showcaseSections)
      .set({ filter: nextFilter, updatedAt: now })
      .where(eq(showcaseSections.id, row.id))
      .run()
    changed++
  }

  const collectionRows = db.select().from(collections).all()

  for (const row of collectionRows) {
    if (!row.dynamicConfig) continue

    const nextConfig = rewriteDynamicConfig(row.dynamicConfig, entityType, targetId, sourceId)
    if (nextConfig === row.dynamicConfig) continue

    db.update(collections)
      .set({ dynamicConfig: nextConfig, updatedAt: now })
      .where(eq(collections.id, row.id))
      .run()
    changed++
  }

  return changed
}

function rewriteDynamicConfig(
  config: DynamicCollectionConfig,
  entityType: AllEntityType,
  targetId: string,
  sourceId: string
): DynamicCollectionConfig {
  let changed = false
  const next = { ...config }

  for (const key of Object.keys(config) as (keyof DynamicCollectionConfig)[]) {
    const item = config[key]
    const nextFilter = rewriteFilterState(key, item.filter, entityType, targetId, sourceId)
    if (nextFilter === item.filter) continue

    next[key] = { ...item, filter: nextFilter }
    changed = true
  }

  return changed ? next : config
}

function rewriteFilterState(
  filterEntityType: AllEntityType,
  filter: FilterState,
  mergedEntityType: AllEntityType,
  targetId: string,
  sourceId: string
): FilterState {
  const spec = getFilterQuerySpec(filterEntityType)
  let changed = false
  const conditions: FilterCondition[] = []

  for (const condition of filter.conditions) {
    if (!isRelationCondition(condition)) {
      conditions.push(condition)
      continue
    }

    const field = spec.fieldByKey.get(condition.field)
    if (field?.kind !== 'relation' || field.targetEntity !== mergedEntityType) {
      conditions.push(condition)
      continue
    }

    const ids = rewriteIds(condition.value, targetId, sourceId)
    if (ids === condition.value) {
      conditions.push(condition)
      continue
    }

    conditions.push({ ...condition, value: ids })
    changed = true
  }

  return changed ? { ...filter, conditions } : filter
}

function rewriteIds(ids: string[], targetId: string, sourceId: string): string[] {
  let changed = false
  const seen = new Set<string>()
  const next: string[] = []

  for (const id of ids) {
    const normalized = id === sourceId ? targetId : id
    if (normalized !== id) changed = true
    if (seen.has(normalized)) {
      changed = true
      continue
    }
    seen.add(normalized)
    next.push(normalized)
  }

  return changed ? next : ids
}
