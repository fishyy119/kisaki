import type { ValidationIssue } from '../../../shared/validation'
import {
  isPlainObject,
  validateOptionalBoolean,
  validateOptionalEnumString,
  validateOptionalFiniteNumber,
  validateOptionalFunction,
  validateOptionalString,
  validateRequiredArray,
  validateRequiredEnumString,
  validateRequiredString,
  validateUnknownKeys
} from '../../../shared/validation'
import {
  FIELD_KEYS,
  NODE_BASE_KEYS,
  RECORD_LIST_COLUMN_KEYS,
  SELECT_OPTION_KEYS,
  SETTINGS_BUTTON_TONE_VALUES,
  SETTINGS_CONTENT_LAYOUT_VALUES,
  SETTINGS_FIELD_ORIENTATION_VALUES,
  SETTINGS_IMAGE_FIT_VALUES,
  SETTINGS_NODE_WIDTH_VALUES,
  SETTINGS_NOTICE_TONE_VALUES,
  SETTINGS_RECORD_LIST_COLUMN_KIND_VALUES,
  SETTINGS_STATUS_TONE_VALUES,
  SETTINGS_TABLE_COLUMN_KIND_VALUES,
  SETTINGS_TEXT_INPUT_MODE_VALUES,
  SETTINGS_TEXT_TONE_VALUES,
  TAB_KEYS,
  TABLE_COLUMN_KEYS,
  VALUE_NODE_BASE_KEYS,
  type SettingsValueSchema,
  type SurfaceValidationState
} from './constants'
import {
  createKeySet,
  createSurfaceValidationState,
  pushUniqueKeyIssue,
  validateContentColumns,
  validateFieldSpan,
  validateRecordArray,
  validateValueAgainstSchema
} from './helpers'

export function validateSettingsField(value: unknown): ValidationIssue[] {
  return validateSettingsFieldLike(value, '$', createSurfaceValidationState())
}

export function validateSettingsFields(value: unknown): ValidationIssue[] {
  return validateSettingsFieldArray(value, '$', createSurfaceValidationState())
}

export function validateSettingsTab(value: unknown): ValidationIssue[] {
  return validateSettingsTabLike(value, '$', createSurfaceValidationState(), new Set<string>())
}

export function validateSettingsNode(value: unknown): ValidationIssue[] {
  return validateSettingsNodeLike(value, '$', createSurfaceValidationState())
}

export function validateSettingsNodes(value: unknown): ValidationIssue[] {
  const issues = validateRequiredArray(value, '$', {
    typeMessage: 'Settings nodes must be an array.'
  })

  if (!Array.isArray(value)) {
    return issues
  }

  const state = createSurfaceValidationState()
  for (const [index, node] of value.entries()) {
    issues.push(...validateSettingsNodeLike(node, `$[${index}]`, state))
  }

  return issues
}

export function validateSettingsFieldArray(
  value: unknown,
  path: string,
  state: SurfaceValidationState,
  minLength = 0
): ValidationIssue[] {
  const issues = validateRequiredArray(value, path, {
    minLength,
    typeMessage: 'fields must be an array.',
    valueMessage: `fields must contain at least ${minLength} field(s).`
  })

  if (!Array.isArray(value)) {
    return issues
  }

  for (const [index, field] of value.entries()) {
    issues.push(...validateSettingsFieldLike(field, `${path}[${index}]`, state))
  }

  return issues
}

export function validateSettingsTabArray(
  value: unknown,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  const issues = validateRequiredArray(value, path, {
    minLength: 1,
    typeMessage: 'tabs must be an array.',
    valueMessage: 'tabs must contain at least one tab.'
  })

  if (!Array.isArray(value)) {
    return issues
  }

  const seenTabIds = new Set<string>()
  for (const [index, tab] of value.entries()) {
    issues.push(...validateSettingsTabLike(tab, `${path}[${index}]`, state, seenTabIds))
  }

  return issues
}

function validateSettingsFieldLike(
  value: unknown,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path, message: 'Settings field must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(value, FIELD_KEYS, path),
    ...validateRequiredString(value.id, `${path}.id`, {
      trim: true,
      valueMessage: 'Field id must be a non-empty string.'
    }),
    ...validateOptionalString(value.label, `${path}.label`, {
      typeMessage: 'label must be a string when provided.'
    }),
    ...validateOptionalString(value.description, `${path}.description`, {
      typeMessage: 'description must be a string when provided.'
    }),
    ...validateOptionalBoolean(value.hidden, `${path}.hidden`).map((issue) => ({
      ...issue,
      message: 'hidden must be a boolean when provided.'
    })),
    ...validateOptionalBoolean(value.disabled, `${path}.disabled`).map((issue) => ({
      ...issue,
      message: 'disabled must be a boolean when provided.'
    })),
    ...validateOptionalEnumString(
      value.orientation,
      `${path}.orientation`,
      SETTINGS_FIELD_ORIENTATION_VALUES,
      'orientation must be vertical, horizontal, or responsive.'
    ),
    ...validateFieldSpan(value.span, `${path}.span`),
    ...validateOptionalEnumString(
      value.contentLayout,
      `${path}.contentLayout`,
      SETTINGS_CONTENT_LAYOUT_VALUES,
      'contentLayout must be stack, inline, or grid.'
    ),
    ...validateContentColumns(value.contentColumns, `${path}.contentColumns`)
  ]

  if (typeof value.id === 'string') {
    if (state.fieldIds.has(value.id)) {
      issues.push({
        path: `${path}.id`,
        message: 'Field id must be unique within a settings surface.'
      })
    }
    state.fieldIds.add(value.id)
  }

  issues.push(...validateFieldContent(value.content, `${path}.content`, state))
  return issues
}

function validateSettingsTabLike(
  value: unknown,
  path: string,
  state: SurfaceValidationState,
  seenTabIds: Set<string>
): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path, message: 'Settings tab must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(value, TAB_KEYS, path),
    ...validateRequiredString(value.id, `${path}.id`, {
      trim: true,
      valueMessage: 'Tab id must be a non-empty string.'
    }),
    ...validateRequiredString(value.label, `${path}.label`, {
      trim: true,
      valueMessage: 'Tab label must be a non-empty string.'
    }),
    ...validateOptionalString(value.description, `${path}.description`, {
      typeMessage: 'description must be a string when provided.'
    }),
    ...validateOptionalString(value.icon, `${path}.icon`, {
      typeMessage: 'icon must be a string when provided.'
    }),
    ...validateSettingsFieldArray(value.fields, `${path}.fields`, state)
  ]

  if (typeof value.id === 'string') {
    if (seenTabIds.has(value.id)) {
      issues.push({
        path: `${path}.id`,
        message: 'Tab id must be unique within a settings root model.'
      })
    }
    seenTabIds.add(value.id)
  }

  return issues
}

function validateFieldContent(
  value: unknown,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  const issues = validateRequiredArray(value, path, {
    typeMessage: 'content must be an array.'
  })

  if (!Array.isArray(value)) {
    return issues
  }

  for (const [index, node] of value.entries()) {
    issues.push(...validateSettingsNodeLike(node, `${path}[${index}]`, state))
  }

  return issues
}

function validateSettingsNodeLike(
  value: unknown,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path, message: 'Settings node must be an object.' }]
  }

  if (typeof value.kind !== 'string') {
    return [{ path: `${path}.kind`, message: 'kind must be a string.' }]
  }

  switch (value.kind) {
    case 'switch':
      return validateSettingsValueNode(value, path, state, 'boolean')
    case 'checkbox':
      return validateSettingsValueNode(value, path, state, 'boolean')
    case 'select':
      return validateSettingsSelect(value, path, state)
    case 'multiSelect':
      return validateSettingsMultiSelect(value, path, state)
    case 'textInput':
      return validateSettingsTextInput(value, path, state)
    case 'textarea':
      return validateSettingsTextarea(value, path, state)
    case 'numberInput':
      return validateSettingsNumberInput(value, path, state)
    case 'stringList':
      return validateSettingsStringList(value, path, state)
    case 'recordList':
      return validateSettingsRecordList(value, path, state)
    case 'button':
      return validateSettingsButton(value, path, state)
    case 'text':
      return validateSettingsText(value, path, state)
    case 'notice':
      return validateSettingsNotice(value, path, state)
    case 'status':
      return validateSettingsStatus(value, path, state)
    case 'table':
      return validateSettingsTable(value, path, state)
    case 'image':
      return validateSettingsImage(value, path, state)
    case 'divider':
      return validateSettingsDivider(value, path, state)
    default:
      return [{ path: `${path}.kind`, message: 'Unknown settings node kind.' }]
  }
}

function validateSettingsValueNode(
  value: Record<string, unknown>,
  path: string,
  state: SurfaceValidationState,
  schema: SettingsValueSchema
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(value, createKeySet(...VALUE_NODE_BASE_KEYS), path),
    ...validateSettingsValueNodeBase(value, path, state, schema)
  ]
}

function validateSettingsSelect(
  value: Record<string, unknown>,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(
      value,
      createKeySet(...VALUE_NODE_BASE_KEYS, 'placeholder', 'options'),
      path
    ),
    ...validateSettingsValueNodeBase(value, path, state, 'string'),
    ...validateOptionalString(value.placeholder, `${path}.placeholder`, {
      typeMessage: 'placeholder must be a string when provided.'
    }),
    ...validateSettingsSelectOptions(value.options, `${path}.options`)
  ]
}

function validateSettingsMultiSelect(
  value: Record<string, unknown>,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(value, createKeySet(...VALUE_NODE_BASE_KEYS, 'options'), path),
    ...validateSettingsValueNodeBase(value, path, state, 'stringArray'),
    ...validateSettingsSelectOptions(value.options, `${path}.options`)
  ]
}

function validateSettingsTextInput(
  value: Record<string, unknown>,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(
      value,
      createKeySet(...VALUE_NODE_BASE_KEYS, 'placeholder', 'inputMode'),
      path
    ),
    ...validateSettingsValueNodeBase(value, path, state, 'string'),
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
}

function validateSettingsTextarea(
  value: Record<string, unknown>,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  const issues = [
    ...validateUnknownKeys(
      value,
      createKeySet(...VALUE_NODE_BASE_KEYS, 'placeholder', 'rows'),
      path
    ),
    ...validateSettingsValueNodeBase(value, path, state, 'string'),
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

  return issues
}

function validateSettingsNumberInput(
  value: Record<string, unknown>,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  const issues = [
    ...validateUnknownKeys(
      value,
      createKeySet(...VALUE_NODE_BASE_KEYS, 'placeholder', 'min', 'max', 'step'),
      path
    ),
    ...validateSettingsValueNodeBase(value, path, state, 'number'),
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
    issues.push({ path: `${path}.min`, message: 'min must be less than or equal to max.' })
  }

  if (typeof value.step === 'number' && value.step <= 0) {
    issues.push({ path: `${path}.step`, message: 'step must be greater than zero when provided.' })
  }

  return issues
}

function validateSettingsStringList(
  value: Record<string, unknown>,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(
      value,
      createKeySet(...VALUE_NODE_BASE_KEYS, 'addPlaceholder', 'itemPlaceholder'),
      path
    ),
    ...validateSettingsValueNodeBase(value, path, state, 'stringArray'),
    ...validateOptionalString(value.addPlaceholder, `${path}.addPlaceholder`, {
      typeMessage: 'addPlaceholder must be a string when provided.'
    }),
    ...validateOptionalString(value.itemPlaceholder, `${path}.itemPlaceholder`, {
      typeMessage: 'itemPlaceholder must be a string when provided.'
    })
  ]
}

function validateSettingsRecordList(
  value: Record<string, unknown>,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(
      value,
      createKeySet(...VALUE_NODE_BASE_KEYS, 'columns', 'addLabel', 'emptyLabel'),
      path
    ),
    ...validateSettingsValueNodeBase(value, path, state, 'recordArray'),
    ...validateSettingsRecordListColumns(value.columns, `${path}.columns`),
    ...validateOptionalString(value.addLabel, `${path}.addLabel`, {
      typeMessage: 'addLabel must be a string when provided.'
    }),
    ...validateOptionalString(value.emptyLabel, `${path}.emptyLabel`, {
      typeMessage: 'emptyLabel must be a string when provided.'
    })
  ]
}

function validateSettingsButton(
  value: Record<string, unknown>,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(
      value,
      createKeySet(...NODE_BASE_KEYS, 'label', 'icon', 'tone', 'onClick'),
      path
    ),
    ...validateSettingsNodeBase(value, path, state),
    ...validateRequiredString(value.label, `${path}.label`, {
      trim: true,
      valueMessage: 'label must be a non-empty string.'
    }),
    ...validateOptionalString(value.icon, `${path}.icon`, {
      typeMessage: 'icon must be a string when provided.'
    }),
    ...validateOptionalEnumString(
      value.tone,
      `${path}.tone`,
      SETTINGS_BUTTON_TONE_VALUES,
      'tone must be one of the supported button tones.'
    ),
    ...validateOptionalFunction(value.onClick, `${path}.onClick`).map((issue) => ({
      ...issue,
      message: 'onClick must be a function when provided.'
    }))
  ]
}

function validateSettingsText(
  value: Record<string, unknown>,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(value, createKeySet(...NODE_BASE_KEYS, 'text', 'tone'), path),
    ...validateSettingsNodeBase(value, path, state),
    ...validateRequiredString(value.text, `${path}.text`, {
      valueMessage: 'text must be a non-empty string.'
    }),
    ...validateOptionalEnumString(
      value.tone,
      `${path}.tone`,
      SETTINGS_TEXT_TONE_VALUES,
      'tone must be one of the supported text tones.'
    )
  ]
}

function validateSettingsNotice(
  value: Record<string, unknown>,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(value, createKeySet(...NODE_BASE_KEYS, 'tone', 'text'), path),
    ...validateSettingsNodeBase(value, path, state),
    ...validateRequiredEnumString(
      value.tone,
      `${path}.tone`,
      SETTINGS_NOTICE_TONE_VALUES,
      'tone must be one of the supported notice tones.'
    ),
    ...validateRequiredString(value.text, `${path}.text`, {
      valueMessage: 'text must be a non-empty string.'
    })
  ]
}

function validateSettingsStatus(
  value: Record<string, unknown>,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(value, createKeySet(...NODE_BASE_KEYS, 'tone', 'label', 'value'), path),
    ...validateSettingsNodeBase(value, path, state),
    ...validateOptionalEnumString(
      value.tone,
      `${path}.tone`,
      SETTINGS_STATUS_TONE_VALUES,
      'tone must be one of the supported status tones.'
    ),
    ...validateOptionalString(value.label, `${path}.label`, {
      typeMessage: 'label must be a string when provided.'
    }),
    ...validateRequiredString(value.value, `${path}.value`, {
      valueMessage: 'value must be a non-empty string.'
    })
  ]
}

function validateSettingsTable(
  value: Record<string, unknown>,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(
      value,
      createKeySet(...NODE_BASE_KEYS, 'title', 'columns', 'rows', 'emptyLabel'),
      path
    ),
    ...validateSettingsNodeBase(value, path, state),
    ...validateOptionalString(value.title, `${path}.title`, {
      typeMessage: 'title must be a string when provided.'
    }),
    ...validateOptionalString(value.emptyLabel, `${path}.emptyLabel`, {
      typeMessage: 'emptyLabel must be a string when provided.'
    }),
    ...validateSettingsTableColumns(value.columns, `${path}.columns`),
    ...validateRecordArray(value.rows, `${path}.rows`, 'rows must be an array.')
  ]
}

function validateSettingsImage(
  value: Record<string, unknown>,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(value, createKeySet(...NODE_BASE_KEYS, 'src', 'alt', 'fit'), path),
    ...validateSettingsNodeBase(value, path, state),
    ...validateRequiredString(value.src, `${path}.src`, {
      trim: true,
      valueMessage: 'src must be a non-empty string.'
    }),
    ...validateOptionalString(value.alt, `${path}.alt`, {
      typeMessage: 'alt must be a string when provided.'
    }),
    ...validateOptionalEnumString(
      value.fit,
      `${path}.fit`,
      SETTINGS_IMAGE_FIT_VALUES,
      'fit must be contain or cover.'
    )
  ]
}

function validateSettingsDivider(
  value: Record<string, unknown>,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(value, createKeySet(...NODE_BASE_KEYS), path),
    ...validateSettingsNodeBase(value, path, state)
  ]
}

function validateSettingsNodeBase(
  value: Record<string, unknown>,
  path: string,
  state: SurfaceValidationState
): ValidationIssue[] {
  const issues = [
    ...validateRequiredString(value.id, `${path}.id`, {
      trim: true,
      valueMessage: 'Node id must be a non-empty string.'
    }),
    ...validateOptionalBoolean(value.hidden, `${path}.hidden`).map((issue) => ({
      ...issue,
      message: 'hidden must be a boolean when provided.'
    })),
    ...validateOptionalBoolean(value.disabled, `${path}.disabled`).map((issue) => ({
      ...issue,
      message: 'disabled must be a boolean when provided.'
    })),
    ...validateOptionalBoolean(value.grow, `${path}.grow`).map((issue) => ({
      ...issue,
      message: 'grow must be a boolean when provided.'
    })),
    ...validateOptionalEnumString(
      value.width,
      `${path}.width`,
      SETTINGS_NODE_WIDTH_VALUES,
      'width must be one of the supported node widths.'
    )
  ]

  if (typeof value.id === 'string') {
    if (state.nodeIds.has(value.id)) {
      issues.push({
        path: `${path}.id`,
        message: 'Node id must be unique within a settings surface.'
      })
    }
    state.nodeIds.add(value.id)
  }

  return issues
}

function validateSettingsValueNodeBase(
  value: Record<string, unknown>,
  path: string,
  state: SurfaceValidationState,
  schema: SettingsValueSchema
): ValidationIssue[] {
  const issues = [
    ...validateSettingsNodeBase(value, path, state),
    ...validateOptionalFunction(value.onCommit, `${path}.onCommit`).map((issue) => ({
      ...issue,
      message: 'onCommit must be a function when provided.'
    }))
  ]

  if (value.initialValue === undefined) {
    issues.push({
      path: `${path}.initialValue`,
      message: 'initialValue is required for settings value nodes.'
    })
  } else {
    issues.push(...validateValueAgainstSchema(value.initialValue, schema, `${path}.initialValue`))
  }

  return issues
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
      issues.push({ path: optionPath, message: 'Select option must be an object.' })
      continue
    }

    issues.push(
      ...validateUnknownKeys(option, SELECT_OPTION_KEYS, optionPath),
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
          message: 'Option values must be unique within the same options array.'
        })
      }
      seenValues.add(option.value)
    }
  }

  return issues
}

function validateSettingsTableColumns(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  const issues = validateRequiredArray(value, path, {
    typeMessage: 'columns must be an array when provided.'
  })

  if (!Array.isArray(value)) {
    return issues
  }

  const seenKeys = new Set<string>()
  for (const [index, column] of value.entries()) {
    const columnPath = `${path}[${index}]`
    if (!isPlainObject(column)) {
      issues.push({ path: columnPath, message: 'Table column must be an object.' })
      continue
    }

    issues.push(
      ...validateUnknownKeys(column, TABLE_COLUMN_KEYS, columnPath),
      ...validateRequiredString(column.key, `${columnPath}.key`, {
        trim: true,
        valueMessage: 'Column key must be a non-empty string.'
      }),
      ...validateRequiredString(column.label, `${columnPath}.label`, {
        trim: true,
        valueMessage: 'Column label must be a non-empty string.'
      }),
      ...validateOptionalEnumString(
        column.kind,
        `${columnPath}.kind`,
        SETTINGS_TABLE_COLUMN_KIND_VALUES,
        'Column kind must be text, number, boolean, or badge.'
      )
    )

    pushUniqueKeyIssue(column.key, seenKeys, `${columnPath}.key`, issues, 'Column')
  }

  return issues
}

function validateSettingsRecordListColumns(value: unknown, path: string): ValidationIssue[] {
  const issues = validateRequiredArray(value, path, {
    minLength: 1,
    typeMessage: 'columns must be an array.',
    valueMessage: 'columns must contain at least one column.'
  })

  if (!Array.isArray(value)) {
    return issues
  }

  const seenKeys = new Set<string>()
  for (const [index, column] of value.entries()) {
    const columnPath = `${path}[${index}]`
    if (!isPlainObject(column)) {
      issues.push({ path: columnPath, message: 'Record list column must be an object.' })
      continue
    }

    issues.push(
      ...validateUnknownKeys(column, RECORD_LIST_COLUMN_KEYS, columnPath),
      ...validateRequiredString(column.key, `${columnPath}.key`, {
        trim: true,
        valueMessage: 'Column key must be a non-empty string.'
      }),
      ...validateRequiredString(column.label, `${columnPath}.label`, {
        trim: true,
        valueMessage: 'Column label must be a non-empty string.'
      }),
      ...validateOptionalEnumString(
        column.kind,
        `${columnPath}.kind`,
        SETTINGS_RECORD_LIST_COLUMN_KIND_VALUES,
        'Column kind must be text, select, number, or boolean.'
      )
    )

    if (column.options !== undefined) {
      issues.push(...validateSettingsSelectOptions(column.options, `${columnPath}.options`))
    }

    pushUniqueKeyIssue(column.key, seenKeys, `${columnPath}.key`, issues, 'Column')
  }

  return issues
}
