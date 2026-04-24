import type { Disposable, SerializableValue } from '../shared'
import type { UiCallbackResult } from '../shared'
import type { ValidationIssue } from '../shared/validation'
import {
  isAbortSignal,
  isPlainObject,
  validateOptionalBoolean,
  validateOptionalEnumString,
  validateOptionalFiniteNumber,
  validateOptionalFunction,
  validateOptionalString,
  validateRequiredArray,
  validateRequiredBoolean,
  validateRequiredEnumString,
  validateRequiredFunction,
  validateRequiredString,
  validateSerializableRecord,
  validateUnknownKeys
} from '../shared/validation'

export type SettingsNoticeTone = 'info' | 'warning' | 'error' | 'success'

export type SettingsStatusTone = 'neutral' | 'success' | 'warning' | 'danger'

export type SettingsTextTone = 'default' | 'muted' | 'danger'

export type SettingsButtonTone = 'default' | 'primary' | 'danger'

export interface SettingsNodeBase {
  id: string
  hidden?: boolean
}

export interface SettingsControlBase extends SettingsNodeBase {
  label?: string
  description?: string
  disabled?: boolean
}

export interface SettingsPanelCallbackContext {
  panelId: string
  signal: AbortSignal
}

export interface SettingsSubmitEvent {
  panelId: string
  values: Record<string, SerializableValue>
  signal: AbortSignal
}

export interface SettingsTextNode extends SettingsNodeBase {
  kind: 'text'
  text: string
  tone?: SettingsTextTone
}

export interface SettingsSwitchNode extends SettingsControlBase {
  kind: 'switch'
  value: boolean
  onChange?: (value: boolean, context: SettingsPanelCallbackContext) => Promise<UiCallbackResult>
}

export interface SettingsCheckboxNode extends SettingsControlBase {
  kind: 'checkbox'
  value: boolean
  onChange?: (value: boolean, context: SettingsPanelCallbackContext) => Promise<UiCallbackResult>
}

export interface SettingsSelectOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export interface SettingsSelectNode extends SettingsControlBase {
  kind: 'select'
  value?: string
  placeholder?: string
  options: readonly SettingsSelectOption[]
  onChange?: (value: string, context: SettingsPanelCallbackContext) => Promise<UiCallbackResult>
}

export interface SettingsTextInputNode extends SettingsControlBase {
  kind: 'textInput'
  value?: string
  placeholder?: string
  inputMode?: 'text' | 'email' | 'url' | 'search' | 'tel' | 'password'
  onChange?: (value: string, context: SettingsPanelCallbackContext) => Promise<UiCallbackResult>
}

export interface SettingsTextareaNode extends SettingsControlBase {
  kind: 'textarea'
  value?: string
  placeholder?: string
  rows?: number
  onChange?: (value: string, context: SettingsPanelCallbackContext) => Promise<UiCallbackResult>
}

export interface SettingsNumberInputNode extends SettingsControlBase {
  kind: 'numberInput'
  value?: number
  placeholder?: string
  min?: number
  max?: number
  step?: number
  onChange?: (value: number, context: SettingsPanelCallbackContext) => Promise<UiCallbackResult>
}

export interface SettingsButtonNode extends SettingsControlBase {
  kind: 'button'
  text?: string
  tone?: SettingsButtonTone
  onClick?: (value: undefined, context: SettingsPanelCallbackContext) => Promise<UiCallbackResult>
}

export interface SettingsNoticeNode extends SettingsNodeBase {
  kind: 'notice'
  tone: SettingsNoticeTone
  text: string
}

export interface SettingsStatusNode extends SettingsNodeBase {
  kind: 'status'
  tone?: SettingsStatusTone
  label: string
  value: string
}

export interface SettingsDividerNode extends SettingsNodeBase {
  kind: 'divider'
}

export type SettingsPanelControlNode =
  | SettingsTextNode
  | SettingsSwitchNode
  | SettingsCheckboxNode
  | SettingsSelectNode
  | SettingsTextInputNode
  | SettingsTextareaNode
  | SettingsNumberInputNode
  | SettingsButtonNode
  | SettingsNoticeNode
  | SettingsStatusNode
  | SettingsDividerNode

export interface SettingsSectionNode extends SettingsNodeBase {
  kind: 'section'
  title: string
  description?: string
  controls: readonly SettingsPanelControlNode[]
}

export type SettingsPanelNode =
  | SettingsSectionNode
  | SettingsTextNode
  | SettingsNoticeNode
  | SettingsStatusNode
  | SettingsDividerNode

export interface SettingsResolvedSwitchNode extends Omit<SettingsSwitchNode, 'onChange'> {
  callbackId?: string
}

export interface SettingsResolvedCheckboxNode extends Omit<SettingsCheckboxNode, 'onChange'> {
  callbackId?: string
}

export interface SettingsResolvedSelectNode extends Omit<SettingsSelectNode, 'onChange'> {
  callbackId?: string
}

export interface SettingsResolvedTextInputNode extends Omit<SettingsTextInputNode, 'onChange'> {
  callbackId?: string
}

export interface SettingsResolvedTextareaNode extends Omit<SettingsTextareaNode, 'onChange'> {
  callbackId?: string
}

export interface SettingsResolvedNumberInputNode extends Omit<SettingsNumberInputNode, 'onChange'> {
  callbackId?: string
}

export interface SettingsResolvedButtonNode extends Omit<SettingsButtonNode, 'onClick'> {
  callbackId?: string
}

export type SettingsPanelResolvedControlNode =
  | SettingsTextNode
  | SettingsResolvedSwitchNode
  | SettingsResolvedCheckboxNode
  | SettingsResolvedSelectNode
  | SettingsResolvedTextInputNode
  | SettingsResolvedTextareaNode
  | SettingsResolvedNumberInputNode
  | SettingsResolvedButtonNode
  | SettingsNoticeNode
  | SettingsStatusNode
  | SettingsDividerNode

export interface SettingsResolvedSectionNode extends Omit<SettingsSectionNode, 'controls'> {
  controls: readonly SettingsPanelResolvedControlNode[]
}

export type SettingsPanelResolvedNode =
  | SettingsResolvedSectionNode
  | SettingsTextNode
  | SettingsNoticeNode
  | SettingsStatusNode
  | SettingsDividerNode

export interface SettingsPanelBuilder {
  section(node: Omit<SettingsSectionNode, 'kind'>): SettingsSectionNode
  text(node: Omit<SettingsTextNode, 'kind'>): SettingsTextNode
  switch(node: Omit<SettingsSwitchNode, 'kind'>): SettingsSwitchNode
  checkbox(node: Omit<SettingsCheckboxNode, 'kind'>): SettingsCheckboxNode
  select(node: Omit<SettingsSelectNode, 'kind'>): SettingsSelectNode
  textInput(node: Omit<SettingsTextInputNode, 'kind'>): SettingsTextInputNode
  textarea(node: Omit<SettingsTextareaNode, 'kind'>): SettingsTextareaNode
  numberInput(node: Omit<SettingsNumberInputNode, 'kind'>): SettingsNumberInputNode
  button(node: Omit<SettingsButtonNode, 'kind'>): SettingsButtonNode
  notice(node: Omit<SettingsNoticeNode, 'kind'>): SettingsNoticeNode
  status(node: Omit<SettingsStatusNode, 'kind'>): SettingsStatusNode
  divider(node: Omit<SettingsDividerNode, 'kind'>): SettingsDividerNode
}

export interface SettingsPanelContribution {
  id: string
  title: string
  description?: string
  order?: number
  resolve(panel: SettingsPanelBuilder): Promise<readonly SettingsPanelNode[]>
  onSubmit?(event: SettingsSubmitEvent): Promise<UiCallbackResult>
}

/**
 * Registrar for the extension's single settings panel.
 *
 * An extension may register at most one settings panel at a time. Dispose the
 * previous panel before registering a replacement.
 */
export interface SettingsPanelRegistrar {
  register(contribution: SettingsPanelContribution): Disposable
}

const SETTINGS_NOTICE_TONE_VALUES = ['info', 'warning', 'error', 'success'] as const

const SETTINGS_STATUS_TONE_VALUES = ['neutral', 'success', 'warning', 'danger'] as const

const SETTINGS_TEXT_TONE_VALUES = ['default', 'muted', 'danger'] as const

const SETTINGS_BUTTON_TONE_VALUES = ['default', 'primary', 'danger'] as const

const SETTINGS_TEXT_INPUT_MODE_VALUES = [
  'text',
  'email',
  'url',
  'search',
  'tel',
  'password'
] as const

const SETTINGS_PANEL_CONTRIBUTION_KEYS = new Set<string>([
  'id',
  'title',
  'description',
  'order',
  'resolve',
  'onSubmit'
])

const SETTINGS_SECTION_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'title',
  'description',
  'controls'
])

const SETTINGS_TEXT_KEYS = new Set<string>(['kind', 'id', 'hidden', 'text', 'tone'])

const SETTINGS_SWITCH_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'label',
  'description',
  'disabled',
  'value',
  'onChange'
])

const SETTINGS_RESOLVED_SWITCH_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'label',
  'description',
  'disabled',
  'value',
  'callbackId'
])

const SETTINGS_CHECKBOX_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'label',
  'description',
  'disabled',
  'value',
  'onChange'
])

const SETTINGS_RESOLVED_CHECKBOX_KEYS = new Set<string>([
  'kind',
  'id',
  'hidden',
  'label',
  'description',
  'disabled',
  'value',
  'callbackId'
])

const SETTINGS_SELECT_KEYS = new Set<string>([
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

const SETTINGS_RESOLVED_SELECT_KEYS = new Set<string>([
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

const SETTINGS_TEXT_INPUT_KEYS = new Set<string>([
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

const SETTINGS_RESOLVED_TEXT_INPUT_KEYS = new Set<string>([
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

const SETTINGS_TEXTAREA_KEYS = new Set<string>([
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

const SETTINGS_RESOLVED_TEXTAREA_KEYS = new Set<string>([
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

const SETTINGS_NUMBER_INPUT_KEYS = new Set<string>([
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

const SETTINGS_RESOLVED_NUMBER_INPUT_KEYS = new Set<string>([
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

const SETTINGS_BUTTON_KEYS = new Set<string>([
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

const SETTINGS_RESOLVED_BUTTON_KEYS = new Set<string>([
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

const SETTINGS_NOTICE_KEYS = new Set<string>(['kind', 'id', 'hidden', 'tone', 'text'])

const SETTINGS_STATUS_KEYS = new Set<string>(['kind', 'id', 'hidden', 'tone', 'label', 'value'])

const SETTINGS_DIVIDER_KEYS = new Set<string>(['kind', 'id', 'hidden'])

const SETTINGS_SELECT_OPTION_KEYS = new Set<string>(['value', 'label', 'description', 'disabled'])

function validateSettingsNodeBase(
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

function validateSettingsControlBase(
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

function validateSettingsSelectOptions(value: unknown, path: string): ValidationIssue[] {
  const issues = validateRequiredArray(value, path, {
    typeMessage: 'options must be an array.'
  })

  if (!Array.isArray(value)) {
    return issues
  }

  const seenValues = new Set<string>()
  for (const [index, option] of value.entries()) {
    const optionPath = `${path}[${index}]`

    if (!isPlainObject(option)) {
      issues.push({
        path: optionPath,
        message: 'Select option must be an object.'
      })
      continue
    }

    issues.push(
      ...validateUnknownKeys(option, SETTINGS_SELECT_OPTION_KEYS, optionPath),
      ...validateRequiredString(option.value, `${optionPath}.value`, {
        trim: true,
        valueMessage: 'Option value must be a non-empty string.'
      }),
      ...validateRequiredString(option.label, `${optionPath}.label`, {
        trim: true,
        valueMessage: 'Option label must be a non-empty string.'
      }),
      ...validateOptionalString(option.description, `${optionPath}.description`, {
        typeMessage: 'description must be a string when provided.'
      }),
      ...validateOptionalBoolean(option.disabled, `${optionPath}.disabled`).map((issue) => ({
        ...issue,
        message: 'disabled must be a boolean when provided.'
      }))
    )

    if (typeof option.value === 'string') {
      if (seenValues.has(option.value)) {
        issues.push({
          path: `${optionPath}.value`,
          message: 'Option values must be unique within the same select control.'
        })
      }
      seenValues.add(option.value)
    }
  }

  return issues
}

function validateSettingsResolvedCallbackId(
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

function validateSettingsControlNodeLike(
  value: unknown,
  path: string,
  resolved: boolean,
  seenIds?: Set<string>
): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path, message: 'Settings control node must be an object.' }]
  }

  if (typeof value.kind !== 'string') {
    return [{ path: `${path}.kind`, message: 'kind must be a string.' }]
  }

  switch (value.kind) {
    case 'text':
      return [
        ...validateUnknownKeys(value, SETTINGS_TEXT_KEYS, path),
        ...validateSettingsNodeBase(value, path, seenIds),
        ...validateRequiredString(value.text, `${path}.text`, {
          trim: true,
          valueMessage: 'text must be a non-empty string.'
        }),
        ...validateOptionalEnumString(
          value.tone,
          `${path}.tone`,
          SETTINGS_TEXT_TONE_VALUES,
          'tone must be one of the supported text tones.'
        )
      ]

    case 'switch': {
      const issues = [
        ...validateUnknownKeys(
          value,
          resolved ? SETTINGS_RESOLVED_SWITCH_KEYS : SETTINGS_SWITCH_KEYS,
          path
        ),
        ...validateSettingsControlBase(value, path, seenIds),
        ...validateRequiredBoolean(value.value, `${path}.value`).map((issue) => ({
          ...issue,
          message: 'value must be a boolean.'
        }))
      ]

      if (resolved) {
        issues.push(...validateSettingsResolvedCallbackId(value, path))
      } else {
        issues.push(
          ...validateOptionalFunction(value.onChange, `${path}.onChange`).map((issue) => ({
            ...issue,
            message: 'onChange must be a function when provided.'
          }))
        )
      }

      return issues
    }

    case 'checkbox': {
      const issues = [
        ...validateUnknownKeys(
          value,
          resolved ? SETTINGS_RESOLVED_CHECKBOX_KEYS : SETTINGS_CHECKBOX_KEYS,
          path
        ),
        ...validateSettingsControlBase(value, path, seenIds),
        ...validateRequiredBoolean(value.value, `${path}.value`).map((issue) => ({
          ...issue,
          message: 'value must be a boolean.'
        }))
      ]

      if (resolved) {
        issues.push(...validateSettingsResolvedCallbackId(value, path))
      } else {
        issues.push(
          ...validateOptionalFunction(value.onChange, `${path}.onChange`).map((issue) => ({
            ...issue,
            message: 'onChange must be a function when provided.'
          }))
        )
      }

      return issues
    }

    case 'select': {
      const issues = [
        ...validateUnknownKeys(
          value,
          resolved ? SETTINGS_RESOLVED_SELECT_KEYS : SETTINGS_SELECT_KEYS,
          path
        ),
        ...validateSettingsControlBase(value, path, seenIds),
        ...validateOptionalString(value.value, `${path}.value`, {
          minLength: 0,
          typeMessage: 'value must be a string when provided.'
        }),
        ...validateOptionalString(value.placeholder, `${path}.placeholder`, {
          typeMessage: 'placeholder must be a string when provided.'
        }),
        ...validateSettingsSelectOptions(value.options, `${path}.options`)
      ]

      if (resolved) {
        issues.push(...validateSettingsResolvedCallbackId(value, path))
      } else {
        issues.push(
          ...validateOptionalFunction(value.onChange, `${path}.onChange`).map((issue) => ({
            ...issue,
            message: 'onChange must be a function when provided.'
          }))
        )
      }

      return issues
    }

    case 'textInput': {
      const issues = [
        ...validateUnknownKeys(
          value,
          resolved ? SETTINGS_RESOLVED_TEXT_INPUT_KEYS : SETTINGS_TEXT_INPUT_KEYS,
          path
        ),
        ...validateSettingsControlBase(value, path, seenIds),
        ...validateOptionalString(value.value, `${path}.value`, {
          minLength: 0,
          typeMessage: 'value must be a string when provided.'
        }),
        ...validateOptionalString(value.placeholder, `${path}.placeholder`, {
          typeMessage: 'placeholder must be a string when provided.'
        }),
        ...validateOptionalEnumString(
          value.inputMode,
          `${path}.inputMode`,
          SETTINGS_TEXT_INPUT_MODE_VALUES,
          'inputMode must be one of the supported text input modes.'
        )
      ]

      if (resolved) {
        issues.push(...validateSettingsResolvedCallbackId(value, path))
      } else {
        issues.push(
          ...validateOptionalFunction(value.onChange, `${path}.onChange`).map((issue) => ({
            ...issue,
            message: 'onChange must be a function when provided.'
          }))
        )
      }

      return issues
    }

    case 'textarea': {
      const issues = [
        ...validateUnknownKeys(
          value,
          resolved ? SETTINGS_RESOLVED_TEXTAREA_KEYS : SETTINGS_TEXTAREA_KEYS,
          path
        ),
        ...validateSettingsControlBase(value, path, seenIds),
        ...validateOptionalString(value.value, `${path}.value`, {
          minLength: 0,
          typeMessage: 'value must be a string when provided.'
        }),
        ...validateOptionalString(value.placeholder, `${path}.placeholder`, {
          typeMessage: 'placeholder must be a string when provided.'
        }),
        ...validateOptionalFiniteNumber(
          value.rows,
          `${path}.rows`,
          'rows must be a positive integer when provided.'
        )
      ]

      if (typeof value.rows === 'number' && (!Number.isInteger(value.rows) || value.rows <= 0)) {
        issues.push({
          path: `${path}.rows`,
          message: 'rows must be a positive integer when provided.'
        })
      }

      if (resolved) {
        issues.push(...validateSettingsResolvedCallbackId(value, path))
      } else {
        issues.push(
          ...validateOptionalFunction(value.onChange, `${path}.onChange`).map((issue) => ({
            ...issue,
            message: 'onChange must be a function when provided.'
          }))
        )
      }

      return issues
    }

    case 'numberInput': {
      const issues = [
        ...validateUnknownKeys(
          value,
          resolved ? SETTINGS_RESOLVED_NUMBER_INPUT_KEYS : SETTINGS_NUMBER_INPUT_KEYS,
          path
        ),
        ...validateSettingsControlBase(value, path, seenIds),
        ...validateOptionalFiniteNumber(
          value.value,
          `${path}.value`,
          'value must be a finite number when provided.'
        ),
        ...validateOptionalString(value.placeholder, `${path}.placeholder`, {
          typeMessage: 'placeholder must be a string when provided.'
        }),
        ...validateOptionalFiniteNumber(
          value.min,
          `${path}.min`,
          'min must be a finite number when provided.'
        ),
        ...validateOptionalFiniteNumber(
          value.max,
          `${path}.max`,
          'max must be a finite number when provided.'
        ),
        ...validateOptionalFiniteNumber(
          value.step,
          `${path}.step`,
          'step must be a finite number when provided.'
        )
      ]

      if (typeof value.min === 'number' && typeof value.max === 'number' && value.min > value.max) {
        issues.push({
          path: `${path}.min`,
          message: 'min must be less than or equal to max.'
        })
      }

      if (typeof value.step === 'number' && value.step <= 0) {
        issues.push({
          path: `${path}.step`,
          message: 'step must be greater than zero when provided.'
        })
      }

      if (resolved) {
        issues.push(...validateSettingsResolvedCallbackId(value, path))
      } else {
        issues.push(
          ...validateOptionalFunction(value.onChange, `${path}.onChange`).map((issue) => ({
            ...issue,
            message: 'onChange must be a function when provided.'
          }))
        )
      }

      return issues
    }

    case 'button': {
      const issues = [
        ...validateUnknownKeys(
          value,
          resolved ? SETTINGS_RESOLVED_BUTTON_KEYS : SETTINGS_BUTTON_KEYS,
          path
        ),
        ...validateSettingsControlBase(value, path, seenIds),
        ...validateOptionalString(value.text, `${path}.text`, {
          typeMessage: 'text must be a string when provided.'
        }),
        ...validateOptionalEnumString(
          value.tone,
          `${path}.tone`,
          SETTINGS_BUTTON_TONE_VALUES,
          'tone must be one of the supported button tones.'
        )
      ]

      if (resolved) {
        issues.push(...validateSettingsResolvedCallbackId(value, path))
      } else {
        issues.push(
          ...validateOptionalFunction(value.onClick, `${path}.onClick`).map((issue) => ({
            ...issue,
            message: 'onClick must be a function when provided.'
          }))
        )
      }

      return issues
    }

    case 'notice':
      return [
        ...validateUnknownKeys(value, SETTINGS_NOTICE_KEYS, path),
        ...validateSettingsNodeBase(value, path, seenIds),
        ...validateRequiredEnumString(
          value.tone,
          `${path}.tone`,
          SETTINGS_NOTICE_TONE_VALUES,
          'tone must be one of the supported notice tones.'
        ),
        ...validateRequiredString(value.text, `${path}.text`, {
          trim: true,
          valueMessage: 'text must be a non-empty string.'
        })
      ]

    case 'status':
      return [
        ...validateUnknownKeys(value, SETTINGS_STATUS_KEYS, path),
        ...validateSettingsNodeBase(value, path, seenIds),
        ...validateOptionalEnumString(
          value.tone,
          `${path}.tone`,
          SETTINGS_STATUS_TONE_VALUES,
          'tone must be one of the supported status tones.'
        ),
        ...validateRequiredString(value.label, `${path}.label`, {
          trim: true,
          valueMessage: 'label must be a non-empty string.'
        }),
        ...validateRequiredString(value.value, `${path}.value`, {
          trim: true,
          valueMessage: 'value must be a non-empty string.'
        })
      ]

    case 'divider':
      return [
        ...validateUnknownKeys(value, SETTINGS_DIVIDER_KEYS, path),
        ...validateSettingsNodeBase(value, path, seenIds)
      ]

    default:
      return [{ path: `${path}.kind`, message: 'Unknown settings node kind.' }]
  }
}

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
