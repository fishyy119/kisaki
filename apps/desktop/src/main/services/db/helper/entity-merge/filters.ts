import { eq } from 'drizzle-orm'
import type { AllEntityType, ContentEntityType } from '@shared/common'
import { collections, showcaseSections } from '@shared/db'
import type { DynamicCollectionConfig, FilterState, RelationValue } from '@shared/db/json-types'
import type { DbContext } from '../../types'

const RELATION_FILTER_TARGETS: Record<ContentEntityType, Partial<Record<string, AllEntityType>>> = {
  game: {
    tags: 'tag',
    collections: 'collection',
    persons: 'person',
    companies: 'company',
    characters: 'character'
  },
  character: {
    games: 'game',
    persons: 'person',
    tags: 'tag',
    collections: 'collection'
  },
  person: {
    games: 'game',
    characters: 'character',
    tags: 'tag',
    collections: 'collection'
  },
  company: {
    games: 'game',
    tags: 'tag',
    collections: 'collection'
  }
}

export function rewriteMergeFilters(
  db: DbContext,
  entityType: AllEntityType,
  targetId: string,
  sourceId: string,
  now: Date
): number {
  let changed = 0

  const sectionRows = (db as any).select().from(showcaseSections).all() as {
    id: string
    entityType: AllEntityType
    filter: FilterState
  }[]

  for (const row of sectionRows) {
    const nextFilter = rewriteFilterState(
      row.entityType,
      row.filter,
      entityType,
      targetId,
      sourceId
    )
    if (nextFilter === row.filter) continue
    ;(db as any)
      .update(showcaseSections)
      .set({ filter: nextFilter, updatedAt: now })
      .where(eq(showcaseSections.id, row.id))
      .run()
    changed++
  }

  const collectionRows = (db as any).select().from(collections).all() as {
    id: string
    dynamicConfig: DynamicCollectionConfig | null
  }[]

  for (const row of collectionRows) {
    if (!row.dynamicConfig) continue

    const nextConfig = rewriteDynamicConfig(row.dynamicConfig, entityType, targetId, sourceId)
    if (nextConfig === row.dynamicConfig) continue
    ;(db as any)
      .update(collections)
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

  for (const key of Object.keys(config) as ContentEntityType[]) {
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
  if (!isContentEntityType(filterEntityType)) return filter

  const targets = RELATION_FILTER_TARGETS[filterEntityType]
  let changed = false
  const next: FilterState = { ...filter }

  for (const [key, targetType] of Object.entries(targets)) {
    if (targetType !== mergedEntityType) continue

    const value = filter[key]
    if (!isRelationValue(value)) continue

    const ids = rewriteIds(value.ids, targetId, sourceId)
    if (ids === value.ids) continue

    next[key] = { ...value, ids }
    changed = true
  }

  return changed ? next : filter
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

function isRelationValue(value: unknown): value is RelationValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const relation = value as Record<string, unknown>
  return (
    (relation.match === 'any' || relation.match === 'all') &&
    Array.isArray(relation.ids) &&
    relation.ids.every((id) => typeof id === 'string')
  )
}

function isContentEntityType(value: AllEntityType): value is ContentEntityType {
  return value === 'game' || value === 'character' || value === 'person' || value === 'company'
}
