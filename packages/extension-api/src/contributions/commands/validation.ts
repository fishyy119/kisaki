import type { CommandContribution, CommandContributionExecuteResult } from './contracts'
import type { ValidationIssue } from '../../shared/validation'
import {
  isPlainObject,
  validateOptionalEnumString,
  validateOptionalString,
  validateRequiredFunction,
  validateRequiredString,
  validateJsonObject,
  validateJsonValue,
  validateUnknownKeys
} from '../../shared/validation'

const COMMAND_CONTRIBUTION_KEYS = new Set<string>([
  'id',
  'title',
  'description',
  'argsSchema',
  'defaultArgs',
  'dangerLevel',
  'execute'
])

const COMMAND_DANGER_LEVEL_VALUES = ['none', 'low', 'medium', 'high'] as const

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
    ...validateRequiredFunction(value.execute, '$.execute').map((issue) => ({
      ...issue,
      message: 'execute must be a function.'
    }))
  ]

  if (value.argsSchema !== undefined) {
    issues.push(...validateJsonObject(value.argsSchema, '$.argsSchema'))
  }

  if (value.defaultArgs !== undefined) {
    issues.push(...validateJsonObject(value.defaultArgs, '$.defaultArgs'))
  }

  return issues
}

export function validateCommandContributionExecuteResult(value: unknown): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  return validateJsonValue(value)
}

export function isCommandContribution(value: unknown): value is CommandContribution {
  return validateCommandContributionShape(value).length === 0
}

export function isCommandContributionExecuteResult(
  value: unknown
): value is CommandContributionExecuteResult {
  return validateCommandContributionExecuteResult(value).length === 0
}
