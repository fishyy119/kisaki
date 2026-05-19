import type { CommandContribution, CommandContributionExecuteResult } from './contracts'
import type { ValidationIssue } from '../../shared/validation'
import {
  isPlainObject,
  validateOptionalBoolean,
  validateOptionalEnumString,
  validateOptionalString,
  validateRequiredFunction,
  validateRequiredString,
  validateSerializableRecord,
  validateSerializableValue,
  validateUnknownKeys
} from '../../shared/validation'

const COMMAND_CONTRIBUTION_KEYS = new Set<string>([
  'id',
  'title',
  'description',
  'argsSchema',
  'defaultArgs',
  'dangerLevel',
  'cancelable',
  'notification',
  'execute'
])

const COMMAND_DANGER_LEVEL_VALUES = ['none', 'low', 'medium', 'high'] as const
const COMMAND_NOTIFICATION_KEYS = new Set<string>([
  'title',
  'startMessage',
  'successTitle',
  'successMessage',
  'cancelledTitle',
  'cancelledMessage',
  'failedTitle',
  'failedMessage'
])

export function validateCommandContributionShape(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Command contribution must be an object.' }]
  }

  const issues: ValidationIssue[] = [
    ...validateUnknownKeys(value, COMMAND_CONTRIBUTION_KEYS),
    ...validateRequiredString(value.id, '$.id', {
      trim: true,
      valueMessage: 'Command id must be a non-empty string.'
    }),
    ...validateRequiredString(value.title, '$.title', {
      trim: true,
      valueMessage: 'Command title must be a non-empty string.'
    }),
    ...validateOptionalString(value.description, '$.description', {
      typeMessage: 'description must be a string when provided.'
    }),
    ...validateOptionalEnumString(
      value.dangerLevel,
      '$.dangerLevel',
      COMMAND_DANGER_LEVEL_VALUES,
      'dangerLevel must be one of none, low, medium, or high when provided.'
    ),
    ...validateOptionalBoolean(value.cancelable, '$.cancelable').map((issue) => ({
      ...issue,
      message: 'cancelable must be a boolean when provided.'
    })),
    ...validateCommandNotificationTemplate(value.notification, '$.notification'),
    ...validateRequiredFunction(value.execute, '$.execute').map((issue) => ({
      ...issue,
      message: 'execute must be a function.'
    }))
  ]

  if (value.argsSchema !== undefined) {
    issues.push(...validateSerializableRecord(value.argsSchema, '$.argsSchema'))
  }

  if (value.defaultArgs !== undefined) {
    issues.push(...validateSerializableRecord(value.defaultArgs, '$.defaultArgs'))
  }

  return issues
}

function validateCommandNotificationTemplate(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (!isPlainObject(value)) {
    return [{ path, message: 'notification must be an object when provided.' }]
  }

  return [
    ...validateUnknownKeys(value, COMMAND_NOTIFICATION_KEYS, path),
    ...validateOptionalString(value.title, `${path}.title`, {
      typeMessage: 'notification.title must be a string when provided.'
    }),
    ...validateOptionalString(value.startMessage, `${path}.startMessage`, {
      typeMessage: 'notification.startMessage must be a string when provided.'
    }),
    ...validateOptionalString(value.successTitle, `${path}.successTitle`, {
      typeMessage: 'notification.successTitle must be a string when provided.'
    }),
    ...validateOptionalString(value.successMessage, `${path}.successMessage`, {
      typeMessage: 'notification.successMessage must be a string when provided.'
    }),
    ...validateOptionalString(value.cancelledTitle, `${path}.cancelledTitle`, {
      typeMessage: 'notification.cancelledTitle must be a string when provided.'
    }),
    ...validateOptionalString(value.cancelledMessage, `${path}.cancelledMessage`, {
      typeMessage: 'notification.cancelledMessage must be a string when provided.'
    }),
    ...validateOptionalString(value.failedTitle, `${path}.failedTitle`, {
      typeMessage: 'notification.failedTitle must be a string when provided.'
    }),
    ...validateOptionalString(value.failedMessage, `${path}.failedMessage`, {
      typeMessage: 'notification.failedMessage must be a string when provided.'
    })
  ]
}

export function validateCommandContributionExecuteResult(value: unknown): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  return validateSerializableValue(value)
}

export function isCommandContribution(value: unknown): value is CommandContribution {
  return validateCommandContributionShape(value).length === 0
}

export function isCommandContributionExecuteResult(
  value: unknown
): value is CommandContributionExecuteResult {
  return validateCommandContributionExecuteResult(value).length === 0
}
