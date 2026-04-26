import type { ValidationIssue } from '../../../shared/validation'
import {
  isPlainObject,
  validateOptionalString,
  validateRequiredArray,
  validateRequiredString,
  validateUnknownKeys
} from '../../../shared/validation'
import { SETTINGS_SECTION_KEYS, validateSettingsNodeBase } from './base'
import { validateSettingsControlNodeLike } from './controls'

function validateSettingsSectionNodeLike(
  value: unknown,
  path: string,
  resolved: boolean,
  seenIds?: Set<string>
): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path, message: 'Settings section must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(value, SETTINGS_SECTION_KEYS, path),
    ...validateSettingsNodeBase(value, path, seenIds),
    ...validateRequiredString(value.title, `${path}.title`, {
      trim: true,
      valueMessage: 'title must be a non-empty string.'
    }),
    ...validateOptionalString(value.description, `${path}.description`, {
      typeMessage: 'description must be a string when provided.'
    }),
    ...validateRequiredArray(value.controls, `${path}.controls`, {
      typeMessage: 'controls must be an array.'
    })
  ]

  if (Array.isArray(value.controls)) {
    for (const [index, control] of value.controls.entries()) {
      issues.push(
        ...validateSettingsControlNodeLike(control, `${path}.controls[${index}]`, resolved, seenIds)
      )
    }
  }

  return issues
}

function validateSettingsPanelNodeLike(
  value: unknown,
  path: string,
  resolved: boolean,
  seenIds?: Set<string>
): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path, message: 'Settings panel node must be an object.' }]
  }

  if (typeof value.kind !== 'string') {
    return [{ path: `${path}.kind`, message: 'kind must be a string.' }]
  }

  if (value.kind === 'section') {
    return validateSettingsSectionNodeLike(value, path, resolved, seenIds)
  }

  if (
    value.kind === 'text' ||
    value.kind === 'notice' ||
    value.kind === 'status' ||
    value.kind === 'divider'
  ) {
    return validateSettingsControlNodeLike(value, path, resolved, seenIds)
  }

  return [
    {
      path: `${path}.kind`,
      message:
        'Only section, text, notice, status, and divider nodes are allowed at the panel root.'
    }
  ]
}

function validateSettingsPanelNodeArray(
  value: unknown,
  resolved: boolean,
  path = '$'
): ValidationIssue[] {
  const issues = validateRequiredArray(value, path, {
    typeMessage: 'Settings panel nodes must be an array.'
  })

  if (!Array.isArray(value)) {
    return issues
  }

  const seenIds = new Set<string>()
  for (const [index, node] of value.entries()) {
    issues.push(...validateSettingsPanelNodeLike(node, `${path}[${index}]`, resolved, seenIds))
  }

  return issues
}

export function validateSettingsPanelNode(value: unknown): ValidationIssue[] {
  return validateSettingsPanelNodeLike(value, '$', false)
}

export function validateSettingsPanelNodes(value: unknown): ValidationIssue[] {
  return validateSettingsPanelNodeArray(value, false)
}

export function validateSettingsPanelResolvedNode(value: unknown): ValidationIssue[] {
  return validateSettingsPanelNodeLike(value, '$', true)
}

export function validateSettingsPanelResolvedNodes(value: unknown): ValidationIssue[] {
  return validateSettingsPanelNodeArray(value, true)
}
