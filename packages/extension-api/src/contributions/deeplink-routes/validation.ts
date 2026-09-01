import type { DeeplinkRouteContribution } from './contracts'
import type { ValidationIssue } from '../../shared/validation'
import {
  isPlainObject,
  validateOptionalBoolean,
  validateOptionalString,
  validateRequiredEnumString,
  validateRequiredFunction,
  validateRequiredString,
  validateUnknownKeys
} from '../../shared/validation'

const DEEPLINK_ROUTE_CONTRIBUTION_KEYS = new Set<string>(['id', 'path', 'focus', 'handle'])

const DEEPLINK_ROUTE_HANDLE_EVENT_KEYS = new Set<string>(['path', 'pattern', 'params', 'query'])

const DEEPLINK_ROUTE_HANDLE_RESULT_KEYS = new Set<string>(['status', 'message'])

const DEEPLINK_ROUTE_HANDLE_RESULT_STATUS_VALUES = ['handled', 'failed'] as const

function validateDeeplinkPath(value: unknown, path: string): ValidationIssue[] {
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

function validateDeeplinkRoutePattern(value: unknown, path: string): ValidationIssue[] {
  const issues = validateDeeplinkPath(value, path)
  if (typeof value !== 'string') {
    return issues
  }

  issues.push(...validateDeeplinkRoutePatternSegments(value, path))
  return issues
}

function validateDeeplinkRoutePatternSegments(value: string, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const segments = value === '/' ? [] : value.slice(1).split('/')
  segments.forEach((segment, index) => {
    if (segment.startsWith(':')) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(segment.slice(1))) {
        issues.push({ path, message: `Route parameter segment "${segment}" has an invalid name.` })
      }
      return
    }

    if (segment.startsWith('*')) {
      if (index !== segments.length - 1) {
        issues.push({ path, message: `Route wildcard segment "${segment}" must be final.` })
      }
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(segment.slice(1))) {
        issues.push({ path, message: `Route wildcard segment "${segment}" has an invalid name.` })
      }
      return
    }

    if (segment.includes(':') || segment.includes('*')) {
      issues.push({ path, message: `Route literal segment "${segment}" must not contain : or *.` })
    }
  })

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
    ...validateDeeplinkRoutePattern(value.path, '$.path'),
    ...validateOptionalBoolean(value.focus, '$.focus').map((issue) => ({
      ...issue,
      message: 'focus must be a boolean when provided.'
    })),
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
    ...validateDeeplinkPath(value.path, '$.path'),
    ...validateDeeplinkRoutePattern(value.pattern, '$.pattern')
  ]

  issues.push(...validateStringRecord(value.params, '$.params', 'params'))
  issues.push(...validateStringRecord(value.query, '$.query', 'query'))

  return issues
}

function validateStringRecord(value: unknown, path: string, label: string): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path, message: `${label} must be an object.` }]
  }

  const issues: ValidationIssue[] = []
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string') {
      issues.push({
        path: `${path}.${key}`,
        message: `Deeplink ${label} values must be strings.`
      })
    }
  }
  return issues
}

export function validateDeeplinkRouteHandleResult(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Deeplink route handle result must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, DEEPLINK_ROUTE_HANDLE_RESULT_KEYS),
    ...validateRequiredEnumString(
      value.status,
      '$.status',
      DEEPLINK_ROUTE_HANDLE_RESULT_STATUS_VALUES,
      'status must be either handled or failed.'
    ),
    ...validateOptionalString(value.message, '$.message', {
      typeMessage: 'message must be a string when provided.'
    })
  ]
}

export function isDeeplinkRouteContribution(value: unknown): value is DeeplinkRouteContribution {
  return validateDeeplinkRouteContributionShape(value).length === 0
}
