import { customType } from 'drizzle-orm/sqlite-core'

import { CONTENT_ENTITY_TYPES, type SortDirection } from '@shared/common'
import { parseFilterState } from '@shared/filter/normalization'
import { createEmptyFilter } from '@shared/filter/state'
import type { DynamicCollectionConfig, DynamicEntityConfig } from '../../contracts/json'
import { matchesPlainObject } from './utils'

function createDefaultEntityConfig(): DynamicEntityConfig {
  return { enabled: false, filter: createEmptyFilter(), sortField: 'name', sortDirection: 'asc' }
}

function parseSortDirection(value: unknown): SortDirection {
  return value === 'desc' ? 'desc' : 'asc'
}

function parseEntityConfig(value: unknown): DynamicEntityConfig {
  if (!matchesPlainObject(value)) return createDefaultEntityConfig()
  return {
    enabled: value.enabled === true,
    filter: parseFilterState(value.filter),
    sortField:
      typeof value.sortField === 'string' && value.sortField.trim() ? value.sortField : 'name',
    sortDirection: parseSortDirection(value.sortDirection)
  }
}

/**
 * DynamicCollectionConfig JSON column.
 *
 * Lenient read: every content entity key is deep-normalized and missing keys
 * are filled with a disabled default, so consumers never defend against
 * partial configs. Strict write: value must be a plain object or null.
 */
export const dynamicCollectionConfig = customType<{
  data: DynamicCollectionConfig | null
  driverData: string | null
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string | null): DynamicCollectionConfig | null {
    if (!value) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch {
      return null
    }
    if (!matchesPlainObject(parsed)) return null

    const config = {} as Record<string, DynamicEntityConfig>
    for (const entityType of CONTENT_ENTITY_TYPES) {
      config[entityType] = parseEntityConfig(parsed[entityType])
    }
    return config as DynamicCollectionConfig
  },

  toDriver(value: DynamicCollectionConfig | null): string | null {
    if (value === null || value === undefined) return null
    if (!matchesPlainObject(value)) {
      throw new Error('dynamicCollectionConfig must be an object or null')
    }
    const config = {} as Record<string, DynamicEntityConfig>
    for (const entityType of CONTENT_ENTITY_TYPES) {
      config[entityType] = parseEntityConfig(value[entityType])
    }
    return JSON.stringify(config)
  }
})
