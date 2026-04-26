import type { ValidationIssue } from '../../../shared/validation'
import {
  validateOptionalBoolean,
  validateOptionalString,
  validateRequiredString
} from '../../../shared/validation'

export const SETTINGS_NOTICE_TONE_VALUES = ['info', 'warning', 'error', 'success'] as const

export const SETTINGS_STATUS_TONE_VALUES = ['neutral', 'success', 'warning', 'danger'] as const

export const SETTINGS_TEXT_TONE_VALUES = ['default', 'muted', 'danger'] as const

export const SETTINGS_BUTTON_TONE_VALUES = ['default', 'primary', 'danger'] as const

export const SETTINGS_TEXT_INPUT_MODE_VALUES = [
  'text',
  'email',
  'url',
  'search',
  'tel',
  'password'
] as const

export const SETTINGS_PANEL_CONTRIBUTION_KEYS = new Set<string>([
  'id',
  'title',
  'description',
  'order',
  'resolve',
  'onSubmit'
])

export const SETTINGS_SECTION_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'title',
  'description',
  'controls'
])

export const SETTINGS_TEXT_KEYS = new Set<string>(['kind', 'id', 'hidden', 'text', 'tone'])

export const SETTINGS_SWITCH_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'label',
  'description',
  'disabled',
  'value',
  'onChange'
])

export const SETTINGS_RESOLVED_SWITCH_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'label',
  'description',
  'disabled',
  'value',
  'callbackId'
])

export const SETTINGS_CHECKBOX_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'label',
  'description',
  'disabled',
  'value',
  'onChange'
])

export const SETTINGS_RESOLVED_CHECKBOX_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'label',
  'description',
  'disabled',
  'value',
  'callbackId'
])

export const SETTINGS_SELECT_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'label',
  'description',
  'disabled',
  'value',
  'placeholder',
  'options',
  'onChange'
])

export const SETTINGS_RESOLVED_SELECT_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'label',
  'description',
  'disabled',
  'value',
  'placeholder',
  'options',
  'callbackId'
])

export const SETTINGS_TEXT_INPUT_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'label',
  'description',
  'disabled',
  'value',
  'placeholder',
  'inputMode',
  'onChange'
])

export const SETTINGS_RESOLVED_TEXT_INPUT_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'label',
  'description',
  'disabled',
  'value',
  'placeholder',
  'inputMode',
  'callbackId'
])

export const SETTINGS_TEXTAREA_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'label',
  'description',
  'disabled',
  'value',
  'placeholder',
  'rows',
  'onChange'
])

export const SETTINGS_RESOLVED_TEXTAREA_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'label',
  'description',
  'disabled',
  'value',
  'placeholder',
  'rows',
  'callbackId'
])

export const SETTINGS_NUMBER_INPUT_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'label',
  'description',
  'disabled',
  'value',
  'placeholder',
  'min',
  'max',
  'step',
  'onChange'
])

export const SETTINGS_RESOLVED_NUMBER_INPUT_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'label',
  'description',
  'disabled',
  'value',
  'placeholder',
  'min',
  'max',
  'step',
  'callbackId'
])

export const SETTINGS_BUTTON_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'label',
  'description',
  'disabled',
  'text',
  'tone',
  'onClick'
])

export const SETTINGS_RESOLVED_BUTTON_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'label',
  'description',
  'disabled',
  'text',
  'tone',
  'callbackId'
])

export const SETTINGS_NOTICE_KEYS = new Set<string>(['kind', 'id', 'hidden', 'tone', 'text'])

export const SETTINGS_STATUS_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'tone',
  'label',
  'value'
])

export const SETTINGS_DIVIDER_KEYS = new Set<string>(['kind', 'id', 'hidden'])

export const SETTINGS_SELECT_OPTION_KEYS = new Set<string>([
  'value',
  'label',
  'description',
  'disabled'
])

export function validateSettingsNodeBase(
  value: Record<string, unknown>,
  path: string,
  seenIds?: Set<string>
): ValidationIssue[] {
  const issues = [
    ...validateRequiredString(value.id, `${path}.id`, {
      trim: true,
      valueMessage: 'Node id must be a non-empty string.'
    }),
    ...validateOptionalBoolean(value.hidden, `${path}.hidden`).map((issue) => ({
      ...issue,
      message: 'hidden must be a boolean when provided.'
    }))
  ]

  if (seenIds && typeof value.id === 'string') {
    if (seenIds.has(value.id)) {
      issues.push({
        path: `${path}.id`,
        message: 'Node id must be unique within a settings panel.'
      })
    }
    seenIds.add(value.id)
  }

  return issues
}

export function validateSettingsControlBase(
  value: Record<string, unknown>,
  path: string,
  seenIds?: Set<string>
): ValidationIssue[] {
  return [
    ...validateSettingsNodeBase(value, path, seenIds),
    ...validateOptionalString(value.label, `${path}.label`, {
      typeMessage: 'label must be a string when provided.'
    }),
    ...validateOptionalString(value.description, `${path}.description`, {
      typeMessage: 'description must be a string when provided.'
    }),
    ...validateOptionalBoolean(value.disabled, `${path}.disabled`).map((issue) => ({
      ...issue,
      message: 'disabled must be a boolean when provided.'
    }))
  ]
}

export function validateSettingsResolvedCallbackId(
  value: Record<string, unknown>,
  path: string
): ValidationIssue[] {
  return validateOptionalString(value.callbackId, `${path}.callbackId`, {
    minLength: 1,
    trim: true,
    typeMessage: 'callbackId must be a string when provided.',
    valueMessage: 'callbackId must be a non-empty string when provided.'
  })
}
