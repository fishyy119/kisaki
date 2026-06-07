import type {
  DynamicCollectionConfig as ApiDynamicCollectionConfig,
  DynamicEntityConfig as ApiDynamicEntityConfig,
  JsonObject,
  JsonValue
} from '@kisaki3/extension-api'
import type {
  DynamicCollectionConfig as DbDynamicCollectionConfig,
  DynamicEntityConfig as DbDynamicEntityConfig,
  FilterState,
  FilterValue,
  RelationValue
} from '@shared/db'

export function compactFilter(value: Record<string, FilterValue | undefined>): FilterState {
  const filter: FilterState = {}
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      filter[key] = entry
    }
  }
  return filter
}

export function relationFilter(ids: readonly string[] | undefined): RelationValue | undefined {
  return ids?.length ? { ids: [...ids], match: 'any' } : undefined
}

export function stringArrayFilter(ids: readonly string[] | undefined): string[] | undefined {
  return ids?.length ? [...ids] : undefined
}

export function toDbDynamicCollectionConfig(
  value: ApiDynamicCollectionConfig | undefined
): DbDynamicCollectionConfig | undefined {
  if (!value) {
    return undefined
  }

  return {
    game: toDbDynamicEntityConfig(value.game),
    character: toDbDynamicEntityConfig(value.character),
    person: toDbDynamicEntityConfig(value.person),
    company: toDbDynamicEntityConfig(value.company)
  }
}

export function toApiDynamicCollectionConfig(
  value: DbDynamicCollectionConfig | null | undefined
): ApiDynamicCollectionConfig | undefined {
  if (!value) {
    return undefined
  }

  return {
    game: toApiDynamicEntityConfig(value.game),
    character: toApiDynamicEntityConfig(value.character),
    person: toApiDynamicEntityConfig(value.person),
    company: toApiDynamicEntityConfig(value.company)
  }
}

function toDbDynamicEntityConfig(value: ApiDynamicEntityConfig): DbDynamicEntityConfig {
  return {
    enabled: value.enabled,
    filter: toDbFilterState(value.filter),
    sortField: value.sortField,
    sortDirection: value.sortDirection
  }
}

function toApiDynamicEntityConfig(value: DbDynamicEntityConfig): ApiDynamicEntityConfig {
  return {
    enabled: value.enabled,
    filter: toJsonFilter(value.filter),
    sortField: value.sortField,
    sortDirection: value.sortDirection
  }
}

function toDbFilterState(value: JsonObject): FilterState {
  const filter: FilterState = {}
  for (const [key, entry] of Object.entries(value)) {
    const filterValue = toDbFilterValue(entry)
    if (filterValue !== undefined) {
      filter[key] = filterValue
    }
  }
  return filter
}

function toJsonFilter(value: FilterState): JsonObject {
  const filter: Record<string, JsonValue> = {}
  for (const [key, entry] of Object.entries(value)) {
    filter[key] = toJsonFilterValue(entry)
  }
  return filter
}

function toDbFilterValue(value: JsonValue): FilterValue | undefined {
  if (value === true) {
    return true
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : undefined
  }

  if (Array.isArray(value)) {
    const strings = value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean)
    return strings.length ? strings : undefined
  }

  if (!isJsonObjectLike(value)) {
    return undefined
  }

  const relation = toRelationValue(value)
  if (relation) {
    return relation
  }

  const numberRange = toNumberRangeValue(value)
  if (numberRange) {
    return numberRange
  }

  return toDateRangeValue(value)
}

function toRelationValue(value: JsonObject): RelationValue | undefined {
  const match = value.match
  const ids = value.ids
  if ((match !== 'any' && match !== 'all') || !Array.isArray(ids)) {
    return undefined
  }

  const normalizedIds = ids
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return normalizedIds.length ? { match, ids: normalizedIds } : undefined
}

function toNumberRangeValue(value: JsonObject): FilterValue | undefined {
  const min = value.min
  const max = value.max
  const normalizedMin = typeof min === 'number' ? min : undefined
  const normalizedMax = typeof max === 'number' ? max : undefined

  if (normalizedMin === undefined && normalizedMax === undefined) {
    return undefined
  }

  return { min: normalizedMin, max: normalizedMax }
}

function toDateRangeValue(value: JsonObject): FilterValue | undefined {
  const from = typeof value.from === 'string' && value.from.trim() ? value.from.trim() : undefined
  const to = typeof value.to === 'string' && value.to.trim() ? value.to.trim() : undefined
  return from || to ? { from, to } : undefined
}

function toJsonFilterValue(value: FilterValue): JsonValue {
  if (value === true || typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return [...value]
  }

  if ('ids' in value) {
    return { match: value.match, ids: [...value.ids] }
  }

  const result: Record<string, JsonValue> = {}
  if ('min' in value || 'max' in value) {
    if (value.min !== undefined) {
      result.min = value.min
    }
    if (value.max !== undefined) {
      result.max = value.max
    }
    return result
  }

  if ('from' in value || 'to' in value) {
    if (value.from !== undefined) {
      result.from = value.from
    }
    if (value.to !== undefined) {
      result.to = value.to
    }
  }
  return result
}

function isJsonObjectLike(value: JsonValue): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
