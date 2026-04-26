import type { ValidationIssue } from '../../../shared/validation'
import {
  isPlainObject,
  validateOptionalBoolean,
  validateOptionalEnumString,
  validateOptionalFiniteNumber,
  validateOptionalFunction,
  validateOptionalString,
  validateRequiredArray,
  validateRequiredBoolean,
  validateRequiredEnumString,
  validateRequiredString,
  validateUnknownKeys
} from '../../../shared/validation'
import {
  SETTINGS_BUTTON_KEYS,
  SETTINGS_BUTTON_TONE_VALUES,
  SETTINGS_CHECKBOX_KEYS,
  SETTINGS_DIVIDER_KEYS,
  SETTINGS_NOTICE_KEYS,
  SETTINGS_NOTICE_TONE_VALUES,
  SETTINGS_NUMBER_INPUT_KEYS,
  SETTINGS_RESOLVED_BUTTON_KEYS,
  SETTINGS_RESOLVED_CHECKBOX_KEYS,
  SETTINGS_RESOLVED_NUMBER_INPUT_KEYS,
  SETTINGS_RESOLVED_SELECT_KEYS,
  SETTINGS_RESOLVED_SWITCH_KEYS,
  SETTINGS_RESOLVED_TEXTAREA_KEYS,
  SETTINGS_RESOLVED_TEXT_INPUT_KEYS,
  SETTINGS_SELECT_KEYS,
  SETTINGS_SELECT_OPTION_KEYS,
  SETTINGS_STATUS_KEYS,
  SETTINGS_STATUS_TONE_VALUES,
  SETTINGS_SWITCH_KEYS,
  SETTINGS_TEXTAREA_KEYS,
  SETTINGS_TEXT_INPUT_KEYS,
  SETTINGS_TEXT_INPUT_MODE_VALUES,
  SETTINGS_TEXT_KEYS,
  SETTINGS_TEXT_TONE_VALUES,
  validateSettingsControlBase,
  validateSettingsNodeBase,
  validateSettingsResolvedCallbackId
} from './base'

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

export function validateSettingsControlNodeLike(
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

      pushCallbackValidation(issues, value, path, resolved, 'onChange')
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

      pushCallbackValidation(issues, value, path, resolved, 'onChange')
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

      pushCallbackValidation(issues, value, path, resolved, 'onChange')
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

      pushCallbackValidation(issues, value, path, resolved, 'onChange')
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

      pushCallbackValidation(issues, value, path, resolved, 'onChange')
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

      pushCallbackValidation(issues, value, path, resolved, 'onChange')
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

      pushCallbackValidation(issues, value, path, resolved, 'onClick')
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

function pushCallbackValidation(
  issues: ValidationIssue[],
  value: Record<string, unknown>,
  path: string,
  resolved: boolean,
  callbackKey: 'onChange' | 'onClick'
): void {
  if (resolved) {
    issues.push(...validateSettingsResolvedCallbackId(value, path))
    return
  }

  issues.push(
    ...validateOptionalFunction(value[callbackKey], `${path}.${callbackKey}`).map((issue) => ({
      ...issue,
      message: `${callbackKey} must be a function when provided.`
    }))
  )
}
