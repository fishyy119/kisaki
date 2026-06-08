import type { ValidationIssue } from '../../../shared/validation'
import {
  isPlainObject,
  validateOptionalEnumString,
  validateOptionalString,
  validateUnknownKeys
} from '../../../shared/validation'
import {
  DIALOG_MODEL_KEYS,
  POPOVER_MODEL_KEYS,
  ROOT_MODEL_KEYS,
  SETTINGS_PANEL_POPOVER_WIDTH_VALUES
} from './constants'
import {
  createSurfaceValidationState,
  validateDialogModelBase,
  validateRootModelBase
} from './helpers'
import {
  validateSettingsPanelFieldArray,
  validateSettingsPanelFooterActions,
  validateSettingsPanelTabArray
} from './nodes'

export function validateSettingsPanelRootModel(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Settings panel root model must be an object.' }]
  }

  const state = createSurfaceValidationState()
  const hasFields = value.fields !== undefined
  const hasTabs = value.tabs !== undefined
  const issues = [
    ...validateUnknownKeys(value, ROOT_MODEL_KEYS),
    ...validateRootModelBase(value),
    ...validateSettingsPanelFooterActions(value.footerActions, '$.footerActions')
  ]

  if (hasFields === hasTabs) {
    issues.push({
      path: '$',
      message: 'Root settings panel model must provide exactly one of fields or tabs.'
    })
  }

  if (hasFields) {
    if (value.activeTabId !== undefined) {
      issues.push({
        path: '$.activeTabId',
        message: 'activeTabId is only allowed when root model uses tabs.'
      })
    }
    issues.push(...validateSettingsPanelFieldArray(value.fields, '$.fields', state))
  }

  if (hasTabs) {
    issues.push(...validateSettingsPanelTabArray(value.tabs, '$.tabs', state))
    issues.push(...validateActiveTabId(value.tabs, value.activeTabId))
  }

  return issues
}

export function validateSettingsPanelDialogModel(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Settings panel dialog model must be an object.' }]
  }

  const state = createSurfaceValidationState()
  const issues = [
    ...validateUnknownKeys(value, DIALOG_MODEL_KEYS),
    ...validateDialogModelBase(value),
    ...validateSettingsPanelFooterActions(value.footerActions, '$.footerActions'),
    ...validateSettingsPanelFieldArray(value.fields, '$.fields', state, 1)
  ]

  return issues
}

export function validateSettingsPanelPopoverModel(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Settings panel popover model must be an object.' }]
  }

  const state = createSurfaceValidationState()
  const issues = [
    ...validateUnknownKeys(value, POPOVER_MODEL_KEYS),
    ...validateOptionalString(value.title, '$.title', {
      typeMessage: 'title must be a string when provided.'
    }),
    ...validateOptionalString(value.description, '$.description', {
      typeMessage: 'description must be a string when provided.'
    }),
    ...validateOptionalEnumString(
      value.width,
      '$.width',
      SETTINGS_PANEL_POPOVER_WIDTH_VALUES,
      'width must be one of the supported popover widths.'
    ),
    ...validateSettingsPanelFieldArray(value.fields, '$.fields', state, 1)
  ]

  return issues
}

function validateActiveTabId(tabs: unknown, activeTabId: unknown): ValidationIssue[] {
  const issues = validateOptionalString(activeTabId, '$.activeTabId', {
    trim: true,
    typeMessage: 'activeTabId must be a string when provided.',
    valueMessage: 'activeTabId must be a non-empty string when provided.'
  })

  if (typeof activeTabId !== 'string' || !Array.isArray(tabs)) {
    return issues
  }

  const tabIds = new Set(
    tabs
      .filter(isPlainObject)
      .map((tab) => tab.id)
      .filter((id): id is string => typeof id === 'string')
  )

  if (!tabIds.has(activeTabId)) {
    issues.push({
      path: '$.activeTabId',
      message: 'activeTabId must reference an existing tab.'
    })
  }

  return issues
}
