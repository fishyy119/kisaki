import type { DeeplinkContribution } from './contracts'
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

const DEEPLINK_CONTRIBUTION_KEYS = new Set<string>(['id', 'path', 'handle'])

const DEEPLINK_REQUEST_KEYS = new Set<string>(['path', 'params', 'rawUrl'])

const DEEPLINK_RESPONSE_KEYS = new Set<string>(['success', 'status', 'message', 'data'])

const DEEPLINK_RESPONSE_STATUS_VALUES = ['handled', 'ignored', 'error'] as const

export function validateDeeplinkContributionShape(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Deeplink contribution must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, DEEPLINK_CONTRIBUTION_KEYS),
    ...validateRequiredString(value.id, '$.id', {
      trim: true,
      valueMessage: 'Contribution id must be a non-empty string.'
    }),
    ...validateRequiredString(value.path, '$.path', {
      trim: true,
      valueMessage: 'path must be a non-empty string.'
    }),
    ...validateRequiredFunction(value.handle, '$.handle').map((issue) => ({
      ...issue,
      message: 'handle must be a function.'
    }))
  ]
}

export function validateDeeplinkRequest(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Deeplink request must be an object.' }]
  }

  const issues: ValidationIssue[] = [
    ...validateUnknownKeys(value, DEEPLINK_REQUEST_KEYS),
    ...validateRequiredString(value.path, '$.path', {
      trim: true,
      valueMessage: 'path must be a non-empty string.'
    }),
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

export function validateDeeplinkResponse(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Deeplink response must be an object.' }]
  }

  const issues: ValidationIssue[] = [
    ...validateUnknownKeys(value, DEEPLINK_RESPONSE_KEYS),
    ...validateRequiredBoolean(value.success, '$.success').map((issue) => ({
      ...issue,
      message: 'success must be a boolean.'
    })),
    ...validateOptionalEnumString(
      value.status,
      '$.status',
      DEEPLINK_RESPONSE_STATUS_VALUES,
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

export function isDeeplinkContribution(value: unknown): value is DeeplinkContribution {
  return validateDeeplinkContributionShape(value).length === 0
}
