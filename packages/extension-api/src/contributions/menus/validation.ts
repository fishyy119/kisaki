import type { EntityMenuContribution, EntityMenuInput } from './contracts'
import type { ValidationIssue } from '../../shared/validation'
import {
  isPlainObject,
  validateOptionalBoolean,
  validateOptionalFiniteNumber,
  validateOptionalString,
  validateRequiredArray,
  validateRequiredBoolean,
  validateRequiredFunction,
  validateRequiredString,
  validateUnknownKeys
} from '../../shared/validation'

const ENTITY_MENU_MAX_SUBMENU_DEPTH = 3

const ENTITY_MENU_CONTRIBUTION_KEYS = new Set<string>(['id', 'order', 'resolve'])

const ENTITY_MENU_NODE_BASE_KEYS = new Set<string>(['kind', 'id', 'hidden', 'disabled'])

const ENTITY_MENU_ACTION_NODE_KEYS = new Set<string>([
  ...ENTITY_MENU_NODE_BASE_KEYS,
  'label',
  'icon',
  'tone',
  'shortcut',
  'onClick'
])

const ENTITY_MENU_CHECKBOX_NODE_KEYS = new Set<string>([
  ...ENTITY_MENU_NODE_BASE_KEYS,
  'label',
  'icon',
  'checked',
  'onChange'
])

const ENTITY_MENU_SELECT_NODE_KEYS = new Set<string>([
  ...ENTITY_MENU_NODE_BASE_KEYS,
  'label',
  'icon',
  'value',
  'options',
  'onChange'
])

const ENTITY_MENU_SUBMENU_NODE_KEYS = new Set<string>([
  ...ENTITY_MENU_NODE_BASE_KEYS,
  'label',
  'icon',
  'children'
])

const ENTITY_MENU_SEPARATOR_NODE_KEYS = new Set<string>(['kind', 'id', 'hidden'])

const ENTITY_MENU_SELECT_OPTION_KEYS = new Set<string>(['value', 'label', 'disabled'])

function validateEntityMenuContributionBase(
  value: Record<string, unknown>,
  path: string
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(value, ENTITY_MENU_CONTRIBUTION_KEYS, path),
    ...validateRequiredString(value.id, `${path}.id`, {
      trim: true,
      valueMessage: 'Contribution id must be a non-empty string.'
    }),
    ...validateOptionalFiniteNumber(
      value.order,
      `${path}.order`,
      'order must be a finite number when provided.'
    ),
    ...validateRequiredFunction(value.resolve, `${path}.resolve`).map((issue) => ({
      ...issue,
      message: 'resolve must be a function.'
    }))
  ]
}

function validateEntityMenuNodeBase(
  value: Record<string, unknown>,
  path: string
): ValidationIssue[] {
  return [
    ...validateRequiredString(value.id, `${path}.id`, {
      trim: true,
      valueMessage: 'Entity menu node id must be a non-empty string.'
    }),
    ...validateOptionalBoolean(value.hidden, `${path}.hidden`).map((issue) => ({
      ...issue,
      message: 'hidden must be a boolean when provided.'
    })),
    ...validateOptionalBoolean(value.disabled, `${path}.disabled`).map((issue) => ({
      ...issue,
      message: 'disabled must be a boolean when provided.'
    }))
  ]
}

function validateEntityMenuIcon(value: unknown, path: string): ValidationIssue[] {
  return validateOptionalString(value, path, {
    typeMessage: 'icon must be a string when provided.'
  })
}

function validateEntityMenuTone(
  value: unknown,
  path: string,
  allowed: readonly string[]
): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (typeof value !== 'string' || !allowed.includes(value)) {
    return [{ path, message: `tone must be one of: ${allowed.join(', ')}.` }]
  }

  return []
}

function validateEntityMenuSelectOptions(value: unknown, path: string): ValidationIssue[] {
  const issues = validateRequiredArray(value, path, {
    typeMessage: 'options must be an array.'
  })

  if (!Array.isArray(value)) {
    return issues
  }

  const seen = new Set<string>()
  for (const [index, option] of value.entries()) {
    const optionPath = `${path}[${index}]`

    if (!isPlainObject(option)) {
      issues.push({
        path: optionPath,
        message: 'Entity menu select option must be an object.'
      })
      continue
    }

    issues.push(
      ...validateUnknownKeys(option, ENTITY_MENU_SELECT_OPTION_KEYS, optionPath),
      ...validateRequiredString(option.value, `${optionPath}.value`, {
        trim: true,
        valueMessage: 'Option value must be a non-empty string.'
      }),
      ...validateRequiredString(option.label, `${optionPath}.label`, {
        trim: true,
        valueMessage: 'Option label must be a non-empty string.'
      }),
      ...validateOptionalBoolean(option.disabled, `${optionPath}.disabled`).map((issue) => ({
        ...issue,
        message: 'disabled must be a boolean when provided.'
      }))
    )

    if (typeof option.value === 'string') {
      if (seen.has(option.value)) {
        issues.push({
          path: `${optionPath}.value`,
          message: 'Option values must be unique within the same select node.'
        })
      }
      seen.add(option.value)
    }
  }

  return issues
}

function validateEntityMenuNodeLike(
  value: unknown,
  path: string,
  submenuDepth: number
): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path, message: 'Entity menu node must be an object.' }]
  }

  if (typeof value.kind !== 'string') {
    return [{ path: `${path}.kind`, message: 'kind must be a string.' }]
  }

  switch (value.kind) {
    case 'action':
      return [
        ...validateUnknownKeys(value, ENTITY_MENU_ACTION_NODE_KEYS, path),
        ...validateEntityMenuNodeBase(value, path),
        ...validateRequiredString(value.label, `${path}.label`, {
          trim: true,
          valueMessage: 'label must be a non-empty string.'
        }),
        ...validateEntityMenuIcon(value.icon, `${path}.icon`),
        ...validateEntityMenuTone(value.tone, `${path}.tone`, ['default', 'danger']),
        ...validateOptionalString(value.shortcut, `${path}.shortcut`, {
          typeMessage: 'shortcut must be a string when provided.'
        }),
        ...validateRequiredFunction(value.onClick, `${path}.onClick`).map((issue) => ({
          ...issue,
          message: 'onClick must be a function.'
        }))
      ]

    case 'checkbox':
      return [
        ...validateUnknownKeys(value, ENTITY_MENU_CHECKBOX_NODE_KEYS, path),
        ...validateEntityMenuNodeBase(value, path),
        ...validateRequiredString(value.label, `${path}.label`, {
          trim: true,
          valueMessage: 'label must be a non-empty string.'
        }),
        ...validateEntityMenuIcon(value.icon, `${path}.icon`),
        ...validateRequiredBoolean(value.checked, `${path}.checked`).map((issue) => ({
          ...issue,
          message: 'checked must be a boolean.'
        })),
        ...validateRequiredFunction(value.onChange, `${path}.onChange`).map((issue) => ({
          ...issue,
          message: 'onChange must be a function.'
        }))
      ]

    case 'select':
      return [
        ...validateUnknownKeys(value, ENTITY_MENU_SELECT_NODE_KEYS, path),
        ...validateEntityMenuNodeBase(value, path),
        ...validateRequiredString(value.label, `${path}.label`, {
          trim: true,
          valueMessage: 'label must be a non-empty string.'
        }),
        ...validateEntityMenuIcon(value.icon, `${path}.icon`),
        ...validateRequiredString(value.value, `${path}.value`, {
          minLength: 0,
          typeMessage: 'value must be a string.'
        }),
        ...validateEntityMenuSelectOptions(value.options, `${path}.options`),
        ...validateRequiredFunction(value.onChange, `${path}.onChange`).map((issue) => ({
          ...issue,
          message: 'onChange must be a function.'
        }))
      ]

    case 'submenu': {
      const issues = [
        ...validateUnknownKeys(value, ENTITY_MENU_SUBMENU_NODE_KEYS, path),
        ...validateEntityMenuNodeBase(value, path),
        ...validateRequiredString(value.label, `${path}.label`, {
          trim: true,
          valueMessage: 'label must be a non-empty string.'
        }),
        ...validateEntityMenuIcon(value.icon, `${path}.icon`)
      ]

      if (submenuDepth > ENTITY_MENU_MAX_SUBMENU_DEPTH) {
        issues.push({
          path,
          message: `submenu nesting depth must not exceed ${ENTITY_MENU_MAX_SUBMENU_DEPTH}.`
        })
      }

      issues.push(...validateEntityMenuNodeArray(value.children, `${path}.children`, submenuDepth))

      if (Array.isArray(value.children) && getVisibleEntityMenuNodes(value.children).length === 0) {
        issues.push({
          path: `${path}.children`,
          message: 'submenu children must contain at least one visible node.'
        })
      }

      return issues
    }

    case 'separator':
      return [
        ...validateUnknownKeys(value, ENTITY_MENU_SEPARATOR_NODE_KEYS, path),
        ...validateOptionalString(value.id, `${path}.id`, {
          minLength: 1,
          trim: true,
          typeMessage: 'separator id must be a string when provided.',
          valueMessage: 'separator id must be a non-empty string when provided.'
        }),
        ...validateOptionalBoolean(value.hidden, `${path}.hidden`).map((issue) => ({
          ...issue,
          message: 'hidden must be a boolean when provided.'
        }))
      ]

    default:
      return [
        {
          path: `${path}.kind`,
          message: 'Unknown menu node kind.'
        }
      ]
  }
}

function validateEntityMenuNodeArray(value: unknown, path = '$', depth = 0): ValidationIssue[] {
  const issues = validateRequiredArray(value, path, {
    typeMessage: 'Entity menu nodes must be an array.'
  })

  if (!Array.isArray(value)) {
    return issues
  }

  const seenIds = new Set<string>()
  for (const [index, node] of value.entries()) {
    const nodePath = `${path}[${index}]`
    issues.push(...validateEntityMenuNodeLike(node, nodePath, depth + 1))

    if (isPlainObject(node) && typeof node.id === 'string') {
      if (seenIds.has(node.id)) {
        issues.push({
          path: `${nodePath}.id`,
          message: 'Entity menu node id must be unique within the same sibling group.'
        })
      }
      seenIds.add(node.id)
    }
  }

  issues.push(...validateVisibleSeparatorPlacement(value, path))

  return issues
}

function getVisibleEntityMenuNodes(
  nodes: readonly unknown[]
): readonly { node: Record<string, unknown>; index: number }[] {
  return nodes
    .map((node, index) => ({ node, index }))
    .filter(
      (entry): entry is { node: Record<string, unknown>; index: number } =>
        isPlainObject(entry.node) && entry.node.hidden !== true
    )
}

function validateVisibleSeparatorPlacement(
  nodes: readonly unknown[],
  path: string
): ValidationIssue[] {
  const visibleNodes = getVisibleEntityMenuNodes(nodes)
  const issues: ValidationIssue[] = []

  if (visibleNodes.length === 0) {
    return issues
  }

  const first = visibleNodes[0]
  const last = visibleNodes[visibleNodes.length - 1]

  if (first.node.kind === 'separator') {
    issues.push({
      path: `${path}[${first.index}]`,
      message: 'separator cannot be the first visible node in a sibling group.'
    })
  }

  if (last.index !== first.index && last.node.kind === 'separator') {
    issues.push({
      path: `${path}[${last.index}]`,
      message: 'separator cannot be the last visible node in a sibling group.'
    })
  }

  return issues
}

export function validateEntityMenuContributionShape(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Entity menu contribution must be an object.' }]
  }

  return validateEntityMenuContributionBase(value, '$')
}

export function validateEntityMenuNode(value: unknown): ValidationIssue[] {
  return validateEntityMenuNodeLike(value, '$', 1)
}

export function validateEntityMenuNodes(value: unknown): ValidationIssue[] {
  return validateEntityMenuNodeArray(value)
}

export function isEntityMenuContribution(
  value: unknown
): value is EntityMenuContribution<EntityMenuInput> {
  return validateEntityMenuContributionShape(value).length === 0
}
