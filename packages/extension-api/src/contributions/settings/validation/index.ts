import type {
  SettingsContribution,
  SettingsInteractionResult,
  SettingsNode,
  SettingsResolvedNode,
  SettingsScreenModel
} from '../contracts'
import type { ValidationIssue } from '../../../shared/validation'
import { validateExtensionErrorShape } from '../../../shared/errors'
import {
  isAbortSignal,
  isPlainObject,
  prefixIssues,
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
} from '../../../shared/validation'

const SETTINGS_DIALOG_SIZE_VALUES = ['sm', 'md', 'lg', 'xl'] as const
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
const SETTINGS_REFRESH_SCOPE_VALUES = ['current', 'parent', 'stack'] as const
const SETTINGS_CLOSE_SCOPE_VALUES = ['current', 'all'] as const

const CONTRIBUTION_KEYS = new Set<string>([
  'id',
  'title',
  'description',
  'order',
  'rootScreenId',
  'screens'
])
const SCREEN_KEYS = new Set<string>(['title', 'description', 'size', 'nodes'])
const SCREEN_CONTRIBUTION_KEYS = new Set<string>(['resolve', 'submit'])
const NODE_BASE_KEYS = ['kind', 'id', 'hidden'] as const
const CONTROL_BASE_KEYS = [...NODE_BASE_KEYS, 'label', 'description', 'disabled'] as const
const SELECT_OPTION_KEYS = new Set<string>(['value', 'label', 'description', 'disabled'])
const TARGET_KEYS = new Set<string>(['screenId', 'params'])
const RESULT_KEYS = new Set<string>(['success', 'message', 'error', 'commands'])
const COMMAND_KEYS = new Set<string>(['type', 'scope', 'target'])

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
    ...validateRequiredString(value.rootScreenId, '$.rootScreenId', {
      trim: true,
      valueMessage: 'rootScreenId must be a non-empty string.'
    })
  ]

  if (!isPlainObject(value.screens)) {
    issues.push({
      path: '$.screens',
      message: 'screens must be an object keyed by screen id.'
    })
    return issues
  }

  for (const [screenId, screen] of Object.entries(value.screens)) {
    const screenPath = `$.screens.${screenId}`
    if (!isPlainObject(screen)) {
      issues.push({ path: screenPath, message: 'Settings screen must be an object.' })
      continue
    }

    issues.push(
      ...validateUnknownKeys(screen, SCREEN_CONTRIBUTION_KEYS, screenPath),
      ...validateRequiredFunction(screen.resolve, `${screenPath}.resolve`).map((issue) => ({
        ...issue,
        message: 'resolve must be a function.'
      })),
      ...validateOptionalFunction(screen.submit, `${screenPath}.submit`).map((issue) => ({
        ...issue,
        message: 'submit must be a function when provided.'
      }))
    )
  }

  if (
    typeof value.rootScreenId === 'string' &&
    isPlainObject(value.screens) &&
    !Object.prototype.hasOwnProperty.call(value.screens, value.rootScreenId)
  ) {
    issues.push({
      path: '$.rootScreenId',
      message: 'rootScreenId must reference a registered screen.'
    })
  }

  return issues
}

export function validateSettingsFrameContext(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Settings frame context must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(
      value,
      new Set<string>(['contributionId', 'screenId', 'frameId', 'params', 'signal'])
    ),
    ...validateRequiredString(value.contributionId, '$.contributionId', {
      trim: true,
      valueMessage: 'contributionId must be a non-empty string.'
    }),
    ...validateRequiredString(value.screenId, '$.screenId', {
      trim: true,
      valueMessage: 'screenId must be a non-empty string.'
    }),
    ...validateRequiredString(value.frameId, '$.frameId', {
      trim: true,
      valueMessage: 'frameId must be a non-empty string.'
    }),
    ...validateSerializableRecord(value.params, '$.params')
  ]

  if (!isAbortSignal(value.signal)) {
    issues.push({
      path: '$.signal',
      message: 'signal must be an AbortSignal.'
    })
  }

  return issues
}

export function validateSettingsSubmitEvent(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Settings submit event must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(
      value,
      new Set<string>(['contributionId', 'screenId', 'frameId', 'params', 'values', 'signal'])
    ),
    ...validateRequiredString(value.contributionId, '$.contributionId', {
      trim: true,
      valueMessage: 'contributionId must be a non-empty string.'
    }),
    ...validateRequiredString(value.screenId, '$.screenId', {
      trim: true,
      valueMessage: 'screenId must be a non-empty string.'
    }),
    ...validateRequiredString(value.frameId, '$.frameId', {
      trim: true,
      valueMessage: 'frameId must be a non-empty string.'
    }),
    ...validateSerializableRecord(value.params, '$.params'),
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

export function validateSettingsScreenModel(value: unknown, resolved = false): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Settings screen must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(value, SCREEN_KEYS),
    ...validateOptionalString(value.title, '$.title', {
      typeMessage: 'title must be a string when provided.'
    }),
    ...validateOptionalString(value.description, '$.description', {
      typeMessage: 'description must be a string when provided.'
    }),
    ...validateOptionalEnumString(
      value.size,
      '$.size',
      SETTINGS_DIALOG_SIZE_VALUES,
      'size must be one of the supported dialog sizes.'
    ),
    ...validateRequiredArray(value.nodes, '$.nodes', {
      typeMessage: 'nodes must be an array.'
    })
  ]

  if (Array.isArray(value.nodes)) {
    issues.push(...validateSettingsNodeArray(value.nodes, resolved, '$.nodes'))
  }

  return issues
}

export function validateSettingsResolvedScreenModel(value: unknown): ValidationIssue[] {
  return validateSettingsScreenModel(value, true)
}

export function validateSettingsNode(value: unknown): ValidationIssue[] {
  return validateSettingsNodeLike(value, '$', false)
}

export function validateSettingsNodes(value: unknown): ValidationIssue[] {
  return validateSettingsNodeArray(value, false)
}

export function validateSettingsResolvedNode(value: unknown): ValidationIssue[] {
  return validateSettingsNodeLike(value, '$', true)
}

export function validateSettingsResolvedNodes(value: unknown): ValidationIssue[] {
  return validateSettingsNodeArray(value, true)
}

export function validateSettingsInteractionResult(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Settings interaction result must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(value, RESULT_KEYS),
    ...validateRequiredBoolean(value.success, '$.success').map((issue) => ({
      ...issue,
      message: 'success must be a boolean.'
    })),
    ...validateOptionalString(value.message, '$.message', {
      typeMessage: 'message must be a string when provided.'
    })
  ]

  if (value.success === false) {
    if (value.error === undefined) {
      issues.push({ path: '$.error', message: 'error is required when success is false.' })
    } else {
      issues.push(...prefixIssues('$.error', validateExtensionErrorShape(value.error)))
    }
  } else if (value.error !== undefined) {
    issues.push({ path: '$.error', message: 'error is only allowed when success is false.' })
  }

  if (value.commands !== undefined) {
    issues.push(...validateSettingsCommands(value.commands, '$.commands'))
  }

  return issues
}

export function isSettingsContribution(value: unknown): value is SettingsContribution {
  return validateSettingsContributionShape(value).length === 0
}

export function isSettingsScreenModel(value: unknown): value is SettingsScreenModel {
  return validateSettingsScreenModel(value).length === 0
}

export function isSettingsResolvedNode(value: unknown): value is SettingsResolvedNode {
  return validateSettingsResolvedNode(value).length === 0
}

export function isSettingsNode(value: unknown): value is SettingsNode {
  return validateSettingsNode(value).length === 0
}

export function isSettingsInteractionResult(value: unknown): value is SettingsInteractionResult {
  return validateSettingsInteractionResult(value).length === 0
}

function validateSettingsNodeArray(
  value: unknown,
  resolved: boolean,
  path = '$'
): ValidationIssue[] {
  const issues = validateRequiredArray(value, path, {
    typeMessage: 'Settings nodes must be an array.'
  })

  if (!Array.isArray(value)) {
    return issues
  }

  const seenIds = new Set<string>()
  for (const [index, node] of value.entries()) {
    issues.push(...validateSettingsNodeLike(node, `${path}[${index}]`, resolved, seenIds))
  }

  return issues
}

function validateSettingsNodeLike(
  value: unknown,
  path: string,
  resolved: boolean,
  seenIds?: Set<string>
): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path, message: 'Settings node must be an object.' }]
  }

  if (typeof value.kind !== 'string') {
    return [{ path: `${path}.kind`, message: 'kind must be a string.' }]
  }

  switch (value.kind) {
    case 'section':
      return validateSettingsSection(value, path, resolved, seenIds)
    case 'text':
      return validateSettingsText(value, path, seenIds)
    case 'switch':
      return validateSettingsBooleanControl(value, path, resolved, seenIds, 'onChange')
    case 'checkbox':
      return validateSettingsBooleanControl(value, path, resolved, seenIds, 'onChange')
    case 'select':
      return validateSettingsSelect(value, path, resolved, seenIds)
    case 'textInput':
      return validateSettingsTextControl(value, path, resolved, seenIds, 'textInput')
    case 'textarea':
      return validateSettingsTextControl(value, path, resolved, seenIds, 'textarea')
    case 'numberInput':
      return validateSettingsNumberInput(value, path, resolved, seenIds)
    case 'button':
      return validateSettingsButton(value, path, resolved, seenIds)
    case 'dialog':
      return validateSettingsDialog(value, path, seenIds)
    case 'notice':
      return validateSettingsNotice(value, path, seenIds)
    case 'status':
      return validateSettingsStatus(value, path, seenIds)
    case 'divider':
      return validateSettingsDivider(value, path, seenIds)
    default:
      return [{ path: `${path}.kind`, message: 'Unknown settings node kind.' }]
  }
}

function validateSettingsSection(
  value: Record<string, unknown>,
  path: string,
  resolved: boolean,
  seenIds?: Set<string>
): ValidationIssue[] {
  const issues = [
    ...validateUnknownKeys(
      value,
      createKeySet(...NODE_BASE_KEYS, 'title', 'description', 'children'),
      path
    ),
    ...validateSettingsNodeBase(value, path, seenIds),
    ...validateOptionalString(value.title, `${path}.title`, {
      typeMessage: 'title must be a string when provided.'
    }),
    ...validateOptionalString(value.description, `${path}.description`, {
      typeMessage: 'description must be a string when provided.'
    }),
    ...validateRequiredArray(value.children, `${path}.children`, {
      typeMessage: 'children must be an array.'
    })
  ]

  if (Array.isArray(value.children)) {
    for (const [index, child] of value.children.entries()) {
      issues.push(
        ...validateSettingsNodeLike(child, `${path}.children[${index}]`, resolved, seenIds)
      )
    }
  }

  return issues
}

function validateSettingsText(
  value: Record<string, unknown>,
  path: string,
  seenIds?: Set<string>
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(value, createKeySet(...NODE_BASE_KEYS, 'text', 'tone'), path),
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
}

function validateSettingsBooleanControl(
  value: Record<string, unknown>,
  path: string,
  resolved: boolean,
  seenIds: Set<string> | undefined,
  callbackKey: 'onChange'
): ValidationIssue[] {
  const issues = [
    ...validateUnknownKeys(
      value,
      createKeySet(...CONTROL_BASE_KEYS, 'value', resolved ? 'callbackId' : callbackKey),
      path
    ),
    ...validateSettingsControlBase(value, path, seenIds),
    ...validateRequiredBoolean(value.value, `${path}.value`).map((issue) => ({
      ...issue,
      message: 'value must be a boolean.'
    }))
  ]
  pushCallbackValidation(issues, value, path, resolved, callbackKey)
  return issues
}

function validateSettingsSelect(
  value: Record<string, unknown>,
  path: string,
  resolved: boolean,
  seenIds?: Set<string>
): ValidationIssue[] {
  const issues = [
    ...validateUnknownKeys(
      value,
      createKeySet(
        ...CONTROL_BASE_KEYS,
        'value',
        'placeholder',
        'options',
        resolved ? 'callbackId' : 'onChange'
      ),
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

function validateSettingsTextControl(
  value: Record<string, unknown>,
  path: string,
  resolved: boolean,
  seenIds: Set<string> | undefined,
  kind: 'textInput' | 'textarea'
): ValidationIssue[] {
  const callbackKey = 'onChange'
  const issues = [
    ...validateUnknownKeys(
      value,
      createKeySet(
        ...CONTROL_BASE_KEYS,
        'value',
        'placeholder',
        kind === 'textInput' ? 'inputMode' : 'rows',
        resolved ? 'callbackId' : callbackKey
      ),
      path
    ),
    ...validateSettingsControlBase(value, path, seenIds),
    ...validateOptionalString(value.value, `${path}.value`, {
      minLength: 0,
      typeMessage: 'value must be a string when provided.'
    }),
    ...validateOptionalString(value.placeholder, `${path}.placeholder`, {
      typeMessage: 'placeholder must be a string when provided.'
    })
  ]

  if (kind === 'textInput') {
    issues.push(
      ...validateOptionalEnumString(
        value.inputMode,
        `${path}.inputMode`,
        SETTINGS_TEXT_INPUT_MODE_VALUES,
        'inputMode must be one of the supported text input modes.'
      )
    )
  } else {
    issues.push(
      ...validateOptionalFiniteNumber(
        value.rows,
        `${path}.rows`,
        'rows must be a positive integer when provided.'
      )
    )
    if (typeof value.rows === 'number' && (!Number.isInteger(value.rows) || value.rows <= 0)) {
      issues.push({
        path: `${path}.rows`,
        message: 'rows must be a positive integer when provided.'
      })
    }
  }

  pushCallbackValidation(issues, value, path, resolved, callbackKey)
  return issues
}

function validateSettingsNumberInput(
  value: Record<string, unknown>,
  path: string,
  resolved: boolean,
  seenIds?: Set<string>
): ValidationIssue[] {
  const issues = [
    ...validateUnknownKeys(
      value,
      createKeySet(
        ...CONTROL_BASE_KEYS,
        'value',
        'placeholder',
        'min',
        'max',
        'step',
        resolved ? 'callbackId' : 'onChange'
      ),
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
    issues.push({ path: `${path}.min`, message: 'min must be less than or equal to max.' })
  }

  if (typeof value.step === 'number' && value.step <= 0) {
    issues.push({ path: `${path}.step`, message: 'step must be greater than zero when provided.' })
  }

  pushCallbackValidation(issues, value, path, resolved, 'onChange')
  return issues
}

function validateSettingsButton(
  value: Record<string, unknown>,
  path: string,
  resolved: boolean,
  seenIds?: Set<string>
): ValidationIssue[] {
  const issues = [
    ...validateUnknownKeys(
      value,
      createKeySet(...CONTROL_BASE_KEYS, 'text', 'tone', resolved ? 'callbackId' : 'onClick'),
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

function validateSettingsDialog(
  value: Record<string, unknown>,
  path: string,
  seenIds?: Set<string>
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(value, createKeySet(...CONTROL_BASE_KEYS, 'target'), path),
    ...validateSettingsControlBase(value, path, seenIds),
    ...validateSettingsDialogTarget(value.target, `${path}.target`)
  ]
}

function validateSettingsNotice(
  value: Record<string, unknown>,
  path: string,
  seenIds?: Set<string>
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(value, createKeySet(...NODE_BASE_KEYS, 'tone', 'text'), path),
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
}

function validateSettingsStatus(
  value: Record<string, unknown>,
  path: string,
  seenIds?: Set<string>
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(value, createKeySet(...NODE_BASE_KEYS, 'tone', 'label', 'value'), path),
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
}

function validateSettingsDivider(
  value: Record<string, unknown>,
  path: string,
  seenIds?: Set<string>
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(value, createKeySet(...NODE_BASE_KEYS), path),
    ...validateSettingsNodeBase(value, path, seenIds)
  ]
}

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
        message: 'Node id must be unique within a settings frame.'
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
          message: 'Option values must be unique within the same select control.'
        })
      }
      seenValues.add(option.value)
    }
  }

  return issues
}

function validateSettingsDialogTarget(value: unknown, path: string): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path, message: 'target must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(value, TARGET_KEYS, path),
    ...validateRequiredString(value.screenId, `${path}.screenId`, {
      trim: true,
      valueMessage: 'screenId must be a non-empty string.'
    })
  ]

  if (value.params !== undefined) {
    issues.push(...validateSerializableRecord(value.params, `${path}.params`))
  }

  return issues
}

function validateSettingsCommands(value: unknown, path: string): ValidationIssue[] {
  const issues = validateRequiredArray(value, path, {
    typeMessage: 'commands must be an array.'
  })

  if (!Array.isArray(value)) {
    return issues
  }

  for (const [index, command] of value.entries()) {
    const commandPath = `${path}[${index}]`
    if (!isPlainObject(command)) {
      issues.push({ path: commandPath, message: 'Settings command must be an object.' })
      continue
    }

    issues.push(...validateUnknownKeys(command, COMMAND_KEYS, commandPath))

    if (command.type === 'refresh') {
      issues.push(
        ...validateRequiredEnumString(
          command.scope,
          `${commandPath}.scope`,
          SETTINGS_REFRESH_SCOPE_VALUES,
          'refresh scope must be current, parent, or stack.'
        )
      )
    } else if (command.type === 'close') {
      issues.push(
        ...validateRequiredEnumString(
          command.scope,
          `${commandPath}.scope`,
          SETTINGS_CLOSE_SCOPE_VALUES,
          'close scope must be current or all.'
        )
      )
    } else if (command.type === 'open') {
      issues.push(...validateSettingsDialogTarget(command.target, `${commandPath}.target`))
    } else {
      issues.push({
        path: `${commandPath}.type`,
        message: 'command type must be refresh, close, or open.'
      })
    }
  }

  return issues
}

function pushCallbackValidation(
  issues: ValidationIssue[],
  value: Record<string, unknown>,
  path: string,
  resolved: boolean,
  callbackKey: 'onChange' | 'onClick'
): void {
  if (resolved) {
    issues.push(
      ...validateOptionalString(value.callbackId, `${path}.callbackId`, {
        minLength: 1,
        trim: true,
        typeMessage: 'callbackId must be a string when provided.',
        valueMessage: 'callbackId must be a non-empty string when provided.'
      })
    )
    return
  }

  issues.push(
    ...validateOptionalFunction(value[callbackKey], `${path}.${callbackKey}`).map((issue) => ({
      ...issue,
      message: `${callbackKey} must be a function when provided.`
    }))
  )
}

function createKeySet(...keys: readonly string[]): ReadonlySet<string> {
  return new Set(keys)
}
