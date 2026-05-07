import type { ValidationIssue } from '../../../shared/validation'
import {
  isPlainObject,
  validateOptionalEnumString,
  validateOptionalFiniteNumber,
  validateOptionalFunction,
  validateOptionalString,
  validateRequiredFunction,
  validateRequiredString,
  validateUnknownKeys
} from '../../../shared/validation'
import {
  CONTRIBUTION_KEYS,
  DIALOG_DEFINITION_KEYS,
  POPOVER_DEFINITION_KEYS,
  SETTINGS_DIALOG_SIZE_VALUES,
  SETTINGS_POPOVER_WIDTH_VALUES
} from './constants'
import { validateDefinitionMap } from './helpers'

export function validateSettingsContributionShape(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Settings contribution must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(value, CONTRIBUTION_KEYS),
    ...validateRequiredString(value.id, '$.id', {
      trim: true,
      valueMessage: 'Contribution id must be a non-empty string.'
    }),
    ...validateRequiredString(value.title, '$.title', {
      trim: true,
      valueMessage: 'title must be a non-empty string.'
    }),
    ...validateOptionalString(value.description, '$.description', {
      typeMessage: 'description must be a string when provided.'
    }),
    ...validateOptionalFiniteNumber(
      value.order,
      '$.order',
      'order must be a finite number when provided.'
    ),
    ...validateRequiredFunction(value.resolve, '$.resolve').map((issue) => ({
      ...issue,
      message: 'resolve must be a function.'
    })),
    ...validateOptionalFunction(value.submit, '$.submit').map((issue) => ({
      ...issue,
      message: 'submit must be a function when provided.'
    }))
  ]

  issues.push(
    ...validateDefinitionMap(value.popovers, '$.popovers', validateSettingsPopoverDefinition),
    ...validateDefinitionMap(value.dialogs, '$.dialogs', validateSettingsDialogDefinition)
  )

  return issues
}

export function validateSettingsDialogDefinition(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Settings dialog definition must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, DIALOG_DEFINITION_KEYS),
    ...validateOptionalString(value.title, '$.title', {
      typeMessage: 'title must be a string when provided.'
    }),
    ...validateOptionalEnumString(
      value.size,
      '$.size',
      SETTINGS_DIALOG_SIZE_VALUES,
      'size must be one of the supported dialog sizes.'
    ),
    ...validateRequiredFunction(value.resolve, '$.resolve').map((issue) => ({
      ...issue,
      message: 'resolve must be a function.'
    })),
    ...validateOptionalFunction(value.submit, '$.submit').map((issue) => ({
      ...issue,
      message: 'submit must be a function when provided.'
    }))
  ]
}

export function validateSettingsPopoverDefinition(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Settings popover definition must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, POPOVER_DEFINITION_KEYS),
    ...validateOptionalString(value.title, '$.title', {
      typeMessage: 'title must be a string when provided.'
    }),
    ...validateOptionalEnumString(
      value.width,
      '$.width',
      SETTINGS_POPOVER_WIDTH_VALUES,
      'width must be one of the supported popover widths.'
    ),
    ...validateRequiredFunction(value.resolve, '$.resolve').map((issue) => ({
      ...issue,
      message: 'resolve must be a function.'
    }))
  ]
}
