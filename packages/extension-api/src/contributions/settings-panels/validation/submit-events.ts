import type { SettingsPanelContribution } from '../contracts'
import type { ValidationIssue } from '../../../shared/validation'
import {
  isAbortSignal,
  isPlainObject,
  validateOptionalFiniteNumber,
  validateOptionalFunction,
  validateOptionalString,
  validateRequiredFunction,
  validateRequiredString,
  validateSerializableRecord,
  validateUnknownKeys
} from '../../../shared/validation'
import { SETTINGS_PANEL_CONTRIBUTION_KEYS } from './base'

export function validateSettingsPanelContributionShape(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Settings panel contribution must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, SETTINGS_PANEL_CONTRIBUTION_KEYS),
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
    ...validateOptionalFunction(value.onSubmit, '$.onSubmit').map((issue) => ({
      ...issue,
      message: 'onSubmit must be a function when provided.'
    }))
  ]
}

export function validateSettingsSubmitEvent(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Settings submit event must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(value, new Set<string>(['panelId', 'values', 'signal'])),
    ...validateRequiredString(value.panelId, '$.panelId', {
      trim: true,
      valueMessage: 'panelId must be a non-empty string.'
    }),
    ...validateSerializableRecord(value.values, '$.values')
  ]

  if (!isAbortSignal(value.signal)) {
    issues.push({
      path: '$.signal',
      message: 'signal must be an AbortSignal.'
    })
  }

  return issues
}

export function isSettingsPanelContribution(value: unknown): value is SettingsPanelContribution {
  return validateSettingsPanelContributionShape(value).length === 0
}
