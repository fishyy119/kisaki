import type {
  DynamicCollectionConfig as ApiDynamicCollectionConfig,
  DynamicEntityConfig as ApiDynamicEntityConfig,
  JsonObject
} from '@kisaki3/extension-api'
import { CONTENT_ENTITY_TYPES } from '@shared/entity-types'
import type {
  DynamicCollectionConfig as DbDynamicCollectionConfig,
  DynamicEntityConfig as DbDynamicEntityConfig
} from '@shared/db'
import type { FilterCondition, FilterState } from '@shared/filter/model'
import { parseFilterState } from '@shared/filter/normalization'

/** Builds an all-match FilterState from optional conditions; undefined entries are dropped. */
export function conditionsFilter(
  conditions: readonly (FilterCondition | undefined)[]
): FilterState {
  return {
    match: 'all',
    conditions: conditions.filter(
      (condition): condition is FilterCondition => condition !== undefined
    )
  }
}

export function isCondition(
  field: string,
  value: boolean | undefined
): FilterCondition | undefined {
  return value === undefined ? undefined : { field, op: 'is', value }
}

export function anyOfCondition(
  field: string,
  values: readonly string[] | undefined
): FilterCondition | undefined {
  return values?.length ? { field, op: 'anyOf', value: [...values] } : undefined
}

export function hasAnyOfCondition(
  field: string,
  ids: readonly string[] | undefined
): FilterCondition | undefined {
  return ids?.length ? { field, op: 'hasAnyOf', value: [...ids] } : undefined
}

export function toDbDynamicCollectionConfig(
  value: ApiDynamicCollectionConfig | undefined
): DbDynamicCollectionConfig | undefined {
  if (!value) {
    return undefined
  }

  const config = {} as Record<(typeof CONTENT_ENTITY_TYPES)[number], DbDynamicEntityConfig>
  for (const entityType of CONTENT_ENTITY_TYPES) {
    config[entityType] = toDbDynamicEntityConfig(value[entityType])
  }
  return config
}

export function toApiDynamicCollectionConfig(
  value: DbDynamicCollectionConfig | null | undefined
): ApiDynamicCollectionConfig | undefined {
  if (!value) {
    return undefined
  }

  const config = {} as Record<(typeof CONTENT_ENTITY_TYPES)[number], ApiDynamicEntityConfig>
  for (const entityType of CONTENT_ENTITY_TYPES) {
    config[entityType] = toApiDynamicEntityConfig(value[entityType])
  }
  return config
}

function toDbDynamicEntityConfig(value: ApiDynamicEntityConfig): DbDynamicEntityConfig {
  return {
    enabled: value.enabled,
    // Extension-provided filters are foreign JSON: lenient parse at the boundary.
    filter: parseFilterState(value.filter),
    sortField: value.sortField,
    sortDirection: value.sortDirection
  }
}

function toApiDynamicEntityConfig(value: DbDynamicEntityConfig): ApiDynamicEntityConfig {
  return {
    enabled: value.enabled,
    filter: filterStateToJson(value.filter),
    sortField: value.sortField,
    sortDirection: value.sortDirection
  }
}

/** FilterState is a pure JSON shape; clone it into the extension JSON contract. */
function filterStateToJson(filter: FilterState): JsonObject {
  return structuredClone(filter) as unknown as JsonObject
}
