import type { ValidationIssue } from '../../../shared/validation'
import {
  prefixIssues,
  validateOptionalEnumString,
  validateOptionalString,
  validateRequiredArray,
  validateRequiredBoolean,
  validateRequiredEnumString,
  validateRequiredFiniteNumber,
  validateSerializableRecord
} from '../../../shared/validation'
import {
  SETTINGS_PANEL_DIALOG_SIZE_VALUES,
  SETTINGS_PANEL_FIELD_SPAN_VALUES,
  type SettingsPanelValueSchema,
  type SurfaceValidationState
} from './constants'

export function validateDefinitionMap(
  value: unknown,
  path: string,
  validateDefinition: (definition: unknown) => ValidationIssue[]
): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (!isRecord(value)) {
    return [{ path, message: 'Definition map must be an object keyed by id.' }]
  }

  const issues: ValidationIssue[] = []
  for (const [id, definition] of Object.entries(value)) {
    if (id.trim().length === 0) {
      issues.push({ path, message: 'Definition id must be a non-empty string.' })
    }
    issues.push(...prefixIssues(`${path}.${id}`, validateDefinition(definition)))
  }

  return issues
}

export function validateRootModelBase(value: Record<string, unknown>): ValidationIssue[] {
  return [
    ...validateOptionalString(value.title, '$.title', {
      typeMessage: 'title must be a string when provided.'
    }),
    ...validateOptionalString(value.description, '$.description', {
      typeMessage: 'description must be a string when provided.'
    }),
    ...validateOptionalString(value.submitLabel, '$.submitLabel', {
      trim: true,
      typeMessage: 'submitLabel must be a string when provided.',
      valueMessage: 'submitLabel must be a non-empty string when provided.'
    })
  ]
}

export function validateDialogModelBase(value: Record<string, unknown>): ValidationIssue[] {
  return [
    ...validateRootModelBase(value),
    ...validateOptionalEnumString(
      value.size,
      '$.size',
      SETTINGS_PANEL_DIALOG_SIZE_VALUES,
      'size must be one of the supported dialog sizes.'
    )
  ]
}

export function validateFieldSpan(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (value === 1 || value === 2 || value === 3) {
    return []
  }

  return validateRequiredEnumString(
    value,
    path,
    SETTINGS_PANEL_FIELD_SPAN_VALUES,
    'span must be 1, 2, 3, or full.'
  )
}

export function validateContentColumns(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined || value === 1 || value === 2 || value === 3) {
    return []
  }

  return [{ path, message: 'contentColumns must be 1, 2, or 3 when provided.' }]
}

export function validateRecordArray(
  value: unknown,
  path: string,
  typeMessage: string
): ValidationIssue[] {
  const issues = validateRequiredArray(value, path, { typeMessage })

  if (!Array.isArray(value)) {
    return issues
  }

  for (const [index, row] of value.entries()) {
    issues.push(...validateSerializableRecord(row, `${path}[${index}]`))
  }

  return issues
}

export function validateStringArray(value: unknown, path: string): ValidationIssue[] {
  const issues = validateRequiredArray(value, path, {
    typeMessage: 'value must be an array of strings.'
  })

  if (!Array.isArray(value)) {
    return issues
  }

  for (const [index, item] of value.entries()) {
    if (typeof item !== 'string') {
      issues.push({ path: `${path}[${index}]`, message: 'Array item must be a string.' })
    }
  }

  return issues
}

export function validateValueAgainstSchema(
  value: unknown,
  schema: SettingsPanelValueSchema,
  path: string
): ValidationIssue[] {
  switch (schema) {
    case 'boolean':
      return validateRequiredBoolean(value, path).map((issue) => ({
        ...issue,
        message: 'value must be a boolean.'
      }))
    case 'string':
      return typeof value === 'string' ? [] : [{ path, message: 'value must be a string.' }]
    case 'number':
      return validateRequiredFiniteNumber(value, path, 'value must be a finite number.')
    case 'stringArray':
      return validateStringArray(value, path)
    case 'recordArray':
      return validateRecordArray(value, path, 'value must be an array of records.')
  }
}

export function pushUniqueKeyIssue(
  value: unknown,
  seenKeys: Set<string>,
  path: string,
  issues: ValidationIssue[],
  label: string
): void {
  if (typeof value !== 'string') {
    return
  }

  if (seenKeys.has(value)) {
    issues.push({ path, message: `${label} keys must be unique within the same array.` })
  }

  seenKeys.add(value)
}

export function createSurfaceValidationState(): SurfaceValidationState {
  return {
    fieldIds: new Set<string>(),
    nodeIds: new Set<string>()
  }
}

export function createKeySet(...keys: readonly string[]): ReadonlySet<string> {
  return new Set(keys)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
