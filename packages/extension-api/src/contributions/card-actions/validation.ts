import type { CardActionContribution } from './contracts'
import type { ValidationIssue } from '../../shared/validation'
import {
  isPlainObject,
  validateOptionalFiniteNumber,
  validateOptionalString,
  validateRequiredFunction,
  validateRequiredString,
  validateUnknownKeys
} from '../../shared/validation'

const CARD_ACTION_CONTRIBUTION_KEYS = new Set<string>([
  'id',
  'label',
  'description',
  'order',
  'run'
])

export function validateCardActionContributionShape(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Card action contribution must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, CARD_ACTION_CONTRIBUTION_KEYS),
    ...validateRequiredString(value.id, '$.id', {
      trim: true,
      valueMessage: 'Card action id must be a non-empty string.'
    }),
    ...validateRequiredString(value.label, '$.label', {
      trim: true,
      valueMessage: 'Card action label must be a non-empty string.'
    }),
    ...validateOptionalString(value.description, '$.description', {
      typeMessage: 'description must be a string when provided.'
    }),
    ...validateOptionalFiniteNumber(
      value.order,
      '$.order',
      'order must be a finite number when provided.'
    ),
    ...validateRequiredFunction(value.run, '$.run').map((issue) => ({
      ...issue,
      message: 'run must be a function.'
    }))
  ]
}

export function isCardActionContribution(value: unknown): value is CardActionContribution {
  return validateCardActionContributionShape(value).length === 0
}
