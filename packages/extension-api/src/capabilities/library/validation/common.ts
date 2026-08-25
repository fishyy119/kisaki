import type { LibraryEntityType } from '../entities'
import { DYNAMIC_COLLECTION_ENTITY_TYPES, LIBRARY_ENTITY_TYPES } from '../entities'
import { createValidationError } from '../../../shared/errors'
import { validateJsonObject } from '../../../shared/json'
import type { ValidationIssue } from '../../../shared/validation'
import {
  isPlainObject,
  validateOptionalBoolean,
  validateOptionalEnumString,
  validateOptionalFiniteNumber,
  validateOptionalString,
  validateRequiredArray,
  validateRequiredBoolean,
  validateRequiredEnumString,
  validateRequiredFiniteNumber,
  validateRequiredString,
  validateUnknownKeys
} from '../../../shared/validation'

const ENTITY_REFERENCE_KEYS = new Set<string>(['entityType', 'id'])
const PARTIAL_DATE_KEYS = new Set<string>(['year', 'month', 'day'])
const EXTERNAL_ID_KEYS = new Set<string>(['source', 'id'])
const RELATED_SITE_KEYS = new Set<string>(['label', 'url'])
const SAVE_BACKUP_KEYS = new Set<string>(['backupAt', 'note', 'locked', 'saveFile', 'sizeBytes'])
const DYNAMIC_COLLECTION_KEYS = new Set<string>(DYNAMIC_COLLECTION_ENTITY_TYPES)
const DYNAMIC_ENTITY_CONFIG_KEYS = new Set<string>([
  'enabled',
  'filter',
  'sortField',
  'sortDirection'
])

export const ENTITY_BASE_CREATE_KEYS = ['name', 'description'] as const
export const NAMED_ENTITY_KEYS = ['originalName', 'sortName'] as const
export const RANKED_ENTITY_KEYS = [
  ...ENTITY_BASE_CREATE_KEYS,
  ...NAMED_ENTITY_KEYS,
  'score',
  'isFavorite',
  'isNsfw',
  'externalSites'
] as const

export function assertValidLibraryEntityId(
  value: unknown,
  label = 'library entity id'
): asserts value is string {
  const issues = validateRequiredString(value, '$', {
    trim: true,
    valueMessage: `${label} must be a non-empty string.`
  })
  throwIfValidationIssues(label, issues)
}

export function validateEntityBaseFields(
  input: Record<string, unknown>,
  path: string,
  create: boolean
): ValidationIssue[] {
  const issues = create
    ? validateRequiredString(input.name, `${path}.name`, {
        trim: true,
        valueMessage: 'name must be a non-empty string.'
      })
    : validateOptionalNonEmptyString(input.name, `${path}.name`)

  issues.push(...validateOptionalString(input.description, `${path}.description`))
  return issues
}

export function validateNamedEntityFields(
  input: Record<string, unknown>,
  path: string,
  create: boolean
): ValidationIssue[] {
  return [
    ...validateEntityBaseFields(input, path, create),
    ...validateOptionalString(input.originalName, `${path}.originalName`),
    ...validateOptionalString(input.sortName, `${path}.sortName`)
  ]
}

export function validateRankedEntityFields(
  input: Record<string, unknown>,
  path: string,
  create: boolean
): ValidationIssue[] {
  return [
    ...validateNamedEntityFields(input, path, create),
    ...validateOptionalNullableFiniteNumber(input.score, `${path}.score`),
    ...validateOptionalBoolean(input.isFavorite, `${path}.isFavorite`),
    ...validateOptionalBoolean(input.isNsfw, `${path}.isNsfw`),
    ...validateOptionalExternalSites(input.externalSites, `${path}.externalSites`)
  ]
}

export function validateLibraryEntityReference(
  value: unknown,
  path: string,
  expectedEntityType?: LibraryEntityType
): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, message: 'Library entity reference must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(value, ENTITY_REFERENCE_KEYS, path),
    ...validateRequiredEnumString(
      value.entityType,
      `${path}.entityType`,
      LIBRARY_ENTITY_TYPES,
      'entityType must be one of the supported library entity types.'
    ),
    ...validateRequiredString(value.id, `${path}.id`, {
      trim: true,
      valueMessage: 'id must be a non-empty string.'
    })
  ]

  if (expectedEntityType && value.entityType !== expectedEntityType) {
    issues.push({
      path: `${path}.entityType`,
      message: `entityType must be "${expectedEntityType}".`
    })
  }

  return issues
}

export function validateOptionalPartialDate(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (!isRecord(value)) {
    return [{ path, message: 'Partial date must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(value, PARTIAL_DATE_KEYS, path),
    ...validateOptionalInteger(value.year, `${path}.year`, 'year must be an integer.'),
    ...validateOptionalIntegerInRange(value.month, `${path}.month`, 1, 12),
    ...validateOptionalIntegerInRange(value.day, `${path}.day`, 1, 31)
  ]

  if (Object.keys(value).length === 0) {
    issues.push({ path, message: 'Partial date must carry at least one component.' })
  }

  // A day within an unspecified month has no meaning, so storage rejects it.
  if ('year' in value && 'day' in value && !('month' in value)) {
    issues.push({ path, message: 'Partial date with year and day must also specify month.' })
  }

  return issues
}

export function validateOptionalExternalIds(value: unknown, path: string): ValidationIssue[] {
  return validateOptionalArrayOf(value, path, 'externalIds must be an array.', (item, itemPath) =>
    validateExternalId(item, itemPath)
  )
}

export function validateOptionalExternalSites(value: unknown, path: string): ValidationIssue[] {
  return validateOptionalArrayOf(value, path, 'externalSites must be an array.', (item, itemPath) =>
    validateExternalSite(item, itemPath)
  )
}

export function validateOptionalSaveBackups(value: unknown, path: string): ValidationIssue[] {
  return validateOptionalArrayOf(value, path, 'saveBackups must be an array.', (item, itemPath) =>
    validateSaveBackup(item, itemPath)
  )
}

export function validateOptionalDynamicCollectionConfig(
  value: unknown,
  path: string
): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (!isRecord(value)) {
    return [{ path, message: 'dynamicConfig must be an object.' }]
  }

  const issues = validateUnknownKeys(value, DYNAMIC_COLLECTION_KEYS, path)
  for (const key of DYNAMIC_COLLECTION_KEYS) {
    issues.push(...validateDynamicEntityConfig(value[key], `${path}.${key}`))
  }
  return issues
}

export function validateOptionalStringArray(value: unknown, path: string): ValidationIssue[] {
  return validateOptionalArrayOf(
    value,
    path,
    'Field must be an array of strings.',
    (item, itemPath) =>
      typeof item === 'string' ? [] : [{ path: itemPath, message: 'Array item must be a string.' }]
  )
}

export function validateOptionalArrayOf(
  value: unknown,
  path: string,
  typeMessage: string,
  validateItem: (item: unknown, path: string) => ValidationIssue[]
): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  const issues = validateRequiredArray(value, path, { typeMessage })
  if (!Array.isArray(value)) {
    return issues
  }

  for (const [index, item] of value.entries()) {
    issues.push(...validateItem(item, `${path}[${index}]`))
  }
  return issues
}

export function validateOptionalNullableFiniteNumber(
  value: unknown,
  path: string
): ValidationIssue[] {
  if (value === undefined || value === null) {
    return []
  }

  return validateOptionalFiniteNumber(value, path)
}

export function validateOptionalNullableString(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined || value === null) {
    return []
  }

  return validateOptionalString(value, path)
}

export function validateOptionalNullableEnumString<TValue extends string>(
  value: unknown,
  path: string,
  allowedValues: readonly TValue[],
  message: string
): ValidationIssue[] {
  if (value === undefined || value === null) {
    return []
  }

  return validateOptionalEnumString(value, path, allowedValues, message)
}

export function validateOptionalNonNegativeFiniteNumber(
  value: unknown,
  path: string
): ValidationIssue[] {
  const issues = validateOptionalFiniteNumber(value, path, 'Field must be a finite number.')
  if (typeof value === 'number' && value < 0) {
    issues.push({ path, message: 'Field must be greater than or equal to zero.' })
  }
  return issues
}

export function validateOptionalNonNegativeInteger(
  value: unknown,
  path: string
): ValidationIssue[] {
  const issues = validateOptionalInteger(value, path, 'Field must be an integer.')
  if (typeof value === 'number' && value < 0) {
    issues.push({ path, message: 'Field must be greater than or equal to zero.' })
  }
  return issues
}

/** Nullable non-negative integer, for cleared counters and zero-based indexes. */
export function validateOptionalNullableNonNegativeInteger(
  value: unknown,
  path: string
): ValidationIssue[] {
  if (value === undefined || value === null) {
    return []
  }

  return validateOptionalNonNegativeInteger(value, path)
}

/** Nullable fraction in [0, 1], for progress a reader reports back. */
export function validateOptionalNullableFraction(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined || value === null) {
    return []
  }

  const issues = validateOptionalFiniteNumber(value, path)
  if (typeof value === 'number' && Number.isFinite(value) && (value < 0 || value > 1)) {
    issues.push({ path, message: 'Field must be between 0 and 1.' })
  }
  return issues
}

export function validateOptionalInteger(
  value: unknown,
  path: string,
  message: string
): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return [{ path, message }]
  }

  return []
}

export function validateOptionalIntegerInRange(
  value: unknown,
  path: string,
  min: number,
  max: number
): ValidationIssue[] {
  const issues = validateOptionalInteger(
    value,
    path,
    `Field must be an integer from ${min} to ${max}.`
  )
  if (typeof value === 'number' && Number.isInteger(value) && (value < min || value > max)) {
    issues.push({ path, message: `Field must be from ${min} to ${max}.` })
  }
  return issues
}

export function validateOptionalNonEmptyString(value: unknown, path: string): ValidationIssue[] {
  return validateOptionalString(value, path, {
    minLength: 1,
    trim: true,
    valueMessage: 'Field must be a non-empty string when provided.'
  })
}

export function requireWriteObject(
  value: unknown,
  path: string,
  label: string
): Record<string, unknown> | null {
  if (isRecord(value)) {
    return value
  }

  void path
  void label
  return null
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function throwIfValidationIssues(label: string, issues: readonly ValidationIssue[]): void {
  if (issues.length === 0) {
    return
  }

  throw createValidationError(`${label} is invalid:\n${formatValidationIssues(issues)}`, {
    issues: issues.map((issue) => ({
      path: issue.path,
      message: issue.message
    }))
  })
}

function validateExternalId(value: unknown, path: string): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, message: 'External id must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, EXTERNAL_ID_KEYS, path),
    ...validateRequiredString(value.source, `${path}.source`, {
      trim: true,
      valueMessage: 'source must be a non-empty string.'
    }),
    ...validateRequiredString(value.id, `${path}.id`, {
      trim: true,
      valueMessage: 'id must be a non-empty string.'
    })
  ]
}

function validateExternalSite(value: unknown, path: string): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, message: 'Related site must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, RELATED_SITE_KEYS, path),
    ...validateRequiredString(value.label, `${path}.label`, {
      trim: true,
      valueMessage: 'label must be a non-empty string.'
    }),
    ...validateRequiredString(value.url, `${path}.url`, {
      trim: true,
      valueMessage: 'url must be a non-empty string.'
    })
  ]
}

function validateSaveBackup(value: unknown, path: string): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, message: 'Save backup must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, SAVE_BACKUP_KEYS, path),
    ...validateRequiredFiniteNumber(value.backupAt, `${path}.backupAt`),
    ...validateRequiredString(value.note, `${path}.note`, { minLength: 0 }),
    ...validateRequiredBoolean(value.locked, `${path}.locked`),
    ...validateRequiredString(value.saveFile, `${path}.saveFile`, {
      trim: true,
      valueMessage: 'saveFile must be a non-empty string.'
    }),
    ...validateOptionalNonNegativeFiniteNumber(value.sizeBytes, `${path}.sizeBytes`)
  ]
}

function validateDynamicEntityConfig(value: unknown, path: string): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, message: 'Dynamic entity config must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, DYNAMIC_ENTITY_CONFIG_KEYS, path),
    ...validateRequiredBoolean(value.enabled, `${path}.enabled`),
    ...validateJsonObject(value.filter, `${path}.filter`),
    ...validateRequiredString(value.sortField, `${path}.sortField`, {
      trim: true,
      valueMessage: 'sortField must be a non-empty string.'
    }),
    ...validateRequiredEnumString(
      value.sortDirection,
      `${path}.sortDirection`,
      ['asc', 'desc'] as const,
      'sortDirection must be "asc" or "desc".'
    )
  ]
}

function formatValidationIssues(issues: readonly ValidationIssue[]): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n')
}
