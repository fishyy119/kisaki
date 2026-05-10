import type { DeeplinkRouteContribution } from './contracts'
import type { ValidationIssue } from '../../shared/validation'
import {
  isPlainObject,
  validateOptionalEnumString,
  validateOptionalString,
  validateRequiredBoolean,
  validateRequiredFunction,
  validateRequiredString,
  validateSerializableValue,
  validateUnknownKeys
} from '../../shared/validation'

const DEEPLINK_ROUTE_CONTRIBUTION_KEYS = new Set<string>(['id', 'path', 'handle'])

const DEEPLINK_ROUTE_HANDLE_EVENT_KEYS = new Set<string>(['path', 'params', 'rawUrl'])

const DEEPLINK_ROUTE_HANDLE_RESULT_KEYS = new Set<string>(['success', 'status', 'message', 'data'])

const DEEPLINK_ROUTE_HANDLE_RESULT_STATUS_VALUES = ['handled', 'ignored', 'error'] as const

function validateDeeplinkRoutePath(value: unknown, path: string): ValidationIssue[] {
  const issues = validateRequiredString(value, path, {
    trim: true,
    valueMessage: 'path must be a non-empty string.'
  })

  if (typeof value !== 'string') {
    return issues
  }

  if (!value.startsWith('/')) {
    issues.push({ path, message: 'path must start with /.' })
  }

  if (value.includes('?') || value.includes('#') || /^[a-z][a-z0-9+.-]*:/i.test(value)) {
    issues.push({ path, message: 'path must not include query, hash, or a full URL.' })
  }

  if (value.includes('\\') || value.split('/').some((segment) => segment === '..')) {
    issues.push({ path, message: 'path must not include backslashes or .. segments.' })
  }

  if (value.length > 1 && value.split('/').some((segment, index) => index > 0 && segment === '')) {
    issues.push({ path, message: 'path must not include empty segments.' })
  }

  return issues
}

export function validateDeeplinkRouteContributionShape(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Deeplink route contribution must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, DEEPLINK_ROUTE_CONTRIBUTION_KEYS),
    ...validateRequiredString(value.id, '$.id', {
      trim: true,
      valueMessage: 'Contribution id must be a non-empty string.'
    }),
    ...validateDeeplinkRoutePath(value.path, '$.path'),
    ...validateRequiredFunction(value.handle, '$.handle').map((issue) => ({
      ...issue,
      message: 'handle must be a function.'
    }))
  ]
}

export function validateDeeplinkRouteHandleEvent(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Deeplink route handle event must be an object.' }]
  }

  const issues: ValidationIssue[] = [
    ...validateUnknownKeys(value, DEEPLINK_ROUTE_HANDLE_EVENT_KEYS),
    ...validateDeeplinkRoutePath(value.path, '$.path'),
    ...validateRequiredString(value.rawUrl, '$.rawUrl', {
      trim: true,
      valueMessage: 'rawUrl must be a non-empty string.'
    })
  ]

  if (!isPlainObject(value.params)) {
    issues.push({
      path: '$.params',
      message: 'params must be an object.'
    })
  } else {
    for (const [key, entry] of Object.entries(value.params)) {
      if (typeof entry !== 'string') {
        issues.push({
          path: `$.params.${key}`,
          message: 'Deeplink params values must be strings.'
        })
      }
    }
  }

  return issues
}

export function validateDeeplinkRouteHandleResult(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Deeplink route handle result must be an object.' }]
  }

  const issues: ValidationIssue[] = [
    ...validateUnknownKeys(value, DEEPLINK_ROUTE_HANDLE_RESULT_KEYS),
    ...validateRequiredBoolean(value.success, '$.success').map((issue) => ({
      ...issue,
      message: 'success must be a boolean.'
    })),
    ...validateOptionalEnumString(
      value.status,
      '$.status',
      DEEPLINK_ROUTE_HANDLE_RESULT_STATUS_VALUES,
      'status must be one of handled, ignored, or error when provided.'
    ),
    ...validateOptionalString(value.message, '$.message', {
      typeMessage: 'message must be a string when provided.'
    })
  ]

  if (value.data !== undefined) {
    issues.push(...validateSerializableValue(value.data, '$.data'))
  }

  return issues
}

export function isDeeplinkRouteContribution(value: unknown): value is DeeplinkRouteContribution {
  return validateDeeplinkRouteContributionShape(value).length === 0
}
