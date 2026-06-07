import type { ExtensionErrorShape } from './errors'
import type { JsonObject } from './serialization'
import type { ValidationIssue } from './validation'
import { validateExtensionErrorShape } from './errors'
import {
  isPlainObject,
  prefixIssues,
  validateRequiredBoolean,
  validateUnknownKeys
} from './validation'

/**
 * Structured result contract returned by controlled UI contribution callbacks.
 */

export type UiCallbackResult =
  | { success: true; refresh: boolean }
  | { success: false; refresh: boolean; error: ExtensionErrorShape }

export function createUiSuccess(refresh = false): UiCallbackResult {
  return { success: true, refresh }
}

export function createUiError(
  message: string,
  options: {
    code?: string
    details?: JsonObject
    refresh?: boolean
  } = {}
): UiCallbackResult {
  const error: ExtensionErrorShape = { message }
  if (options.code !== undefined) {
    error.code = options.code
  }
  if (options.details !== undefined) {
    error.details = options.details
  }

  return {
    success: false,
    refresh: options.refresh ?? false,
    error
  }
}

const UI_CALLBACK_RESULT_KEYS = new Set<string>(['success', 'refresh', 'error'])

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
      issues.push(...prefixIssues('$.error', validateExtensionErrorShape(value.error)))
    }
  } else if (value.error !== undefined) {
    issues.push({
      path: '$.error',
      message: 'error is only allowed when success is false.'
    })
  }

  return issues
}

export function isUiCallbackResult(value: unknown): value is UiCallbackResult {
  return validateUiCallbackResult(value).length === 0
}
