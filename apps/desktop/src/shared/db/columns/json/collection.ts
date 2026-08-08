import { customType } from 'drizzle-orm/sqlite-core'

import { CONTENT_ENTITY_TYPES, type SortDirection } from '@shared/common'
import { parseFilterState } from '@shared/filter/normalization'
import { createEmptyFilter } from '@shared/filter/state'
import type { DynamicCollectionConfig, DynamicEntityConfig } from '../../contracts/json'
import { matchesPlainObject, requireCanonicalJsonValue } from './utils'

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
 * Canonical form of a dynamic collection config: every content entity key
 * present and deep-normalized. Returns null when the value is not an object.
 */
export function parseDynamicCollectionConfig(value: unknown): DynamicCollectionConfig | null {
  if (!matchesPlainObject(value)) return null

  const config = {} as Record<string, DynamicEntityConfig>
  for (const entityType of CONTENT_ENTITY_TYPES) {
    config[entityType] = parseEntityConfig(value[entityType])
  }
  return config as DynamicCollectionConfig
}

/**
 * DynamicCollectionConfig JSON column.
 *
 * Lenient read: every content entity key is deep-normalized and missing keys
 * are filled with a disabled default, so consumers never defend against
 * partial configs. Strict write: the value must already be canonical, so
 * editors normalize with `parseDynamicCollectionConfig` before saving.
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
    try {
      return parseDynamicCollectionConfig(JSON.parse(value))
    } catch {
      return null
    }
  },

  toDriver(value: DynamicCollectionConfig | null): string | null {
    if (value === null || value === undefined) return null

    const canonical = parseDynamicCollectionConfig(value)
    if (!canonical) {
      throw new Error('dynamicCollectionConfig must be an object or null')
    }
    return JSON.stringify(requireCanonicalJsonValue('dynamicCollectionConfig', value, canonical))
  }
})
