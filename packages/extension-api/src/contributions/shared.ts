import type { SerializableRecord, ValidationIssue } from '../shared'
import {
  isPlainObject,
  prefixIssues,
  validateOptionalString,
  validateRequiredBoolean,
  validateRequiredString,
  validateSerializableRecord,
  validateUnknownKeys
} from '../validation'

export interface UiCallbackError {
  code?: string
  message: string
  details?: SerializableRecord
}

export type UiCallbackResult =
  | { success: true; refresh: boolean }
  | { success: false; refresh: boolean; error: UiCallbackError }

export function createUiSuccess(refresh = false): UiCallbackResult {
  return { success: true, refresh }
}

export function createUiError(
  message: string,
  options: {
    code?: string
    details?: SerializableRecord
    refresh?: boolean
  } = {}
): UiCallbackResult {
  return {
    success: false,
    refresh: options.refresh ?? false,
    error: {
      code: options.code,
      message,
      details: options.details
    }
  }
}

const UI_CALLBACK_RESULT_KEYS = new Set<string>(['success', 'refresh', 'error'])

const UI_CALLBACK_ERROR_KEYS = new Set<string>(['code', 'message', 'details'])

export function validateUiCallbackError(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'error must be an object.' }]
  }

  issues.push(
    ...validateUnknownKeys(value, UI_CALLBACK_ERROR_KEYS),
    ...validateOptionalString(value.code, '$.code', {
      minLength: 1,
      typeMessage: 'error.code must be a string when provided.',
      valueMessage: 'error.code must be a non-empty string when provided.',
      trim: true
    }),
    ...validateRequiredString(value.message, '$.message', {
      trim: true,
      valueMessage: 'error.message must be a non-empty string.'
    })
  )

  if (value.details !== undefined) {
    issues.push(...validateSerializableRecord(value.details, '$.details'))
  }

  return issues
}

export function validateUiCallbackResult(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Callback result must be an object.' }]
  }

  issues.push(
    ...validateUnknownKeys(value, UI_CALLBACK_RESULT_KEYS),
    ...validateRequiredBoolean(value.success, '$.success').map((issue) => ({
      ...issue,
      message: 'success must be a boolean.'
    })),
    ...validateRequiredBoolean(value.refresh, '$.refresh').map((issue) => ({
      ...issue,
      message: 'refresh must be a boolean.'
    }))
  )

  if (value.success === false) {
    if (value.error === undefined) {
      issues.push({
        path: '$.error',
        message: 'error is required when success is false.'
      })
    } else {
      issues.push(...prefixIssues('$.error', validateUiCallbackError(value.error)))
    }
  } else if (value.error !== undefined) {
    issues.push({
      path: '$.error',
      message: 'error is only allowed when success is false.'
    })
  }

  return issues
}

export function isUiCallbackError(value: unknown): value is UiCallbackError {
  return validateUiCallbackError(value).length === 0
}

export function isUiCallbackResult(value: unknown): value is UiCallbackResult {
  return validateUiCallbackResult(value).length === 0
}
