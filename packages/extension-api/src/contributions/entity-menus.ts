import type { Disposable, ValidationIssue } from '../shared'
import type { LibraryEntityType } from '../capabilities/library'
import type { UiCallbackResult } from './shared'
import {
  isPlainObject,
  validateOptionalBoolean,
  validateOptionalFiniteNumber,
  validateOptionalFunction,
  validateOptionalString,
  validateRequiredArray,
  validateRequiredBoolean,
  validateRequiredEnumString,
  validateRequiredFunction,
  validateRequiredString,
  validateUnknownKeys
} from '../validation'

export const ENTITY_MENU_TARGETS = [
  'game.single',
  'game.batch',
  'character.single',
  'person.single',
  'company.single',
  'collection.single',
  'tag.single'
] as const

export type EntityMenuTarget = (typeof ENTITY_MENU_TARGETS)[number]

export interface GameSingleMenuInput {
  scope: 'single'
  target: 'game.single'
  entityType: 'game'
  entityId: string
}

export interface GameBatchMenuInput {
  scope: 'batch'
  target: 'game.batch'
  entityType: 'game'
  entityIds: readonly string[]
}

export interface CharacterSingleMenuInput {
  scope: 'single'
  target: 'character.single'
  entityType: 'character'
  entityId: string
}

export interface PersonSingleMenuInput {
  scope: 'single'
  target: 'person.single'
  entityType: 'person'
  entityId: string
}

export interface CompanySingleMenuInput {
  scope: 'single'
  target: 'company.single'
  entityType: 'company'
  entityId: string
}

export interface CollectionSingleMenuInput {
  scope: 'single'
  target: 'collection.single'
  entityType: 'collection'
  entityId: string
}

export interface TagSingleMenuInput {
  scope: 'single'
  target: 'tag.single'
  entityType: 'tag'
  entityId: string
}

export type EntityMenuResolveInput =
  | GameSingleMenuInput
  | GameBatchMenuInput
  | CharacterSingleMenuInput
  | PersonSingleMenuInput
  | CompanySingleMenuInput
  | CollectionSingleMenuInput
  | TagSingleMenuInput

export interface EntityMenuCallbackContext {
  contributionId: string
  input: EntityMenuResolveInput
  signal: AbortSignal
}

export interface EntityMenuItemBase {
  id: string
  icon?: string
  description?: string
  hidden?: boolean
  disabled?: boolean
}

export interface ActionMenuNode extends EntityMenuItemBase {
  kind: 'action'
  label: string
  onClick?: (context: EntityMenuCallbackContext) => Promise<UiCallbackResult>
}

export interface CheckboxMenuNode extends EntityMenuItemBase {
  kind: 'checkbox'
  label: string
  checked: boolean
  onChange?: (checked: boolean, context: EntityMenuCallbackContext) => Promise<UiCallbackResult>
}

export interface MenuSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectMenuNode extends EntityMenuItemBase {
  kind: 'select'
  label: string
  value: string
  options: readonly MenuSelectOption[]
  onChange?: (value: string, context: EntityMenuCallbackContext) => Promise<UiCallbackResult>
}

export interface SeparatorMenuNode {
  kind: 'separator'
  id: string
}

export type EntityMenuNode = ActionMenuNode | CheckboxMenuNode | SelectMenuNode | SeparatorMenuNode

export interface ActionMenuItem extends Omit<ActionMenuNode, 'onClick'> {
  callbackId?: string
}

export interface CheckboxMenuItem extends Omit<CheckboxMenuNode, 'onChange'> {
  callbackId?: string
}

export interface SelectMenuItem extends Omit<SelectMenuNode, 'onChange'> {
  callbackId?: string
}

export type EntityMenuItem = ActionMenuItem | CheckboxMenuItem | SelectMenuItem | SeparatorMenuNode

export interface EntityMenuBuilder {
  action(node: Omit<ActionMenuNode, 'kind'>): ActionMenuNode
  checkbox(node: Omit<CheckboxMenuNode, 'kind'>): CheckboxMenuNode
  select(node: Omit<SelectMenuNode, 'kind'>): SelectMenuNode
  separator(node: Omit<SeparatorMenuNode, 'kind'>): SeparatorMenuNode
}

export interface EntityMenuContribution<
  TInput extends EntityMenuResolveInput = EntityMenuResolveInput
> {
  id: string
  target: TInput['target']
  order?: number
  resolve(input: TInput, menu: EntityMenuBuilder): Promise<readonly EntityMenuNode[]>
}

export interface EntityMenuRegistrar {
  register<TInput extends EntityMenuResolveInput>(
    contribution: EntityMenuContribution<TInput>
  ): Disposable
}

export function isEntityMenuTarget(value: string): value is EntityMenuTarget {
  return (ENTITY_MENU_TARGETS as readonly string[]).includes(value)
}

export function isLibraryMenuTargetForEntityType(
  target: EntityMenuTarget,
  entityType: LibraryEntityType
): boolean {
  return target.startsWith(`${entityType}.`)
}

const ENTITY_MENU_CONTRIBUTION_KEYS = new Set<string>(['id', 'target', 'order', 'resolve'])

const ACTION_MENU_NODE_KEYS = new Set<string>([
  'kind',
  'id',
  'label',
  'icon',
  'description',
  'hidden',
  'disabled',
  'onClick'
])

const CHECKBOX_MENU_NODE_KEYS = new Set<string>([
  'kind',
  'id',
  'label',
  'icon',
  'description',
  'hidden',
  'disabled',
  'checked',
  'onChange'
])

const SELECT_MENU_NODE_KEYS = new Set<string>([
  'kind',
  'id',
  'label',
  'icon',
  'description',
  'hidden',
  'disabled',
  'value',
  'options',
  'onChange'
])

const RESOLVED_ACTION_MENU_ITEM_KEYS = new Set<string>([
  'kind',
  'id',
  'label',
  'icon',
  'description',
  'hidden',
  'disabled',
  'callbackId'
])

const RESOLVED_CHECKBOX_MENU_ITEM_KEYS = new Set<string>([
  'kind',
  'id',
  'label',
  'icon',
  'description',
  'hidden',
  'disabled',
  'checked',
  'callbackId'
])

const RESOLVED_SELECT_MENU_ITEM_KEYS = new Set<string>([
  'kind',
  'id',
  'label',
  'icon',
  'description',
  'hidden',
  'disabled',
  'value',
  'options',
  'callbackId'
])

const SEPARATOR_MENU_NODE_KEYS = new Set<string>(['kind', 'id'])

const MENU_SELECT_OPTION_KEYS = new Set<string>(['value', 'label', 'disabled'])

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
    ...validateRequiredEnumString(
      value.target,
      `${path}.target`,
      ENTITY_MENU_TARGETS,
      'target must be one of the official entity menu targets.'
    ),
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

function validateEntityMenuItemBase(
  value: Record<string, unknown>,
  path: string
): ValidationIssue[] {
  return [
    ...validateRequiredString(value.id, `${path}.id`, {
      trim: true,
      valueMessage: 'Menu item id must be a non-empty string.'
    }),
    ...validateOptionalString(value.icon, `${path}.icon`, {
      typeMessage: 'icon must be a string when provided.'
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
    }))
  ]
}

function validateMenuSelectOptions(value: unknown, path: string): ValidationIssue[] {
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
        message: 'Select option must be an object.'
      })
      continue
    }

    issues.push(
      ...validateUnknownKeys(option, MENU_SELECT_OPTION_KEYS, optionPath),
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
          message: 'Option values must be unique within the same select item.'
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
  resolved: boolean
): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path, message: 'Menu node must be an object.' }]
  }

  if (typeof value.kind !== 'string') {
    return [{ path: `${path}.kind`, message: 'kind must be a string.' }]
  }

  switch (value.kind) {
    case 'action': {
      const issues = [
        ...validateUnknownKeys(
          value,
          resolved ? RESOLVED_ACTION_MENU_ITEM_KEYS : ACTION_MENU_NODE_KEYS,
          path
        ),
        ...validateEntityMenuItemBase(value, path),
        ...validateRequiredString(value.label, `${path}.label`, {
          trim: true,
          valueMessage: 'label must be a non-empty string.'
        })
      ]

      if (resolved) {
        issues.push(
          ...validateOptionalString(value.callbackId, `${path}.callbackId`, {
            minLength: 1,
            trim: true,
            typeMessage: 'callbackId must be a string when provided.',
            valueMessage: 'callbackId must be a non-empty string when provided.'
          })
        )
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

    case 'checkbox': {
      const issues = [
        ...validateUnknownKeys(
          value,
          resolved ? RESOLVED_CHECKBOX_MENU_ITEM_KEYS : CHECKBOX_MENU_NODE_KEYS,
          path
        ),
        ...validateEntityMenuItemBase(value, path),
        ...validateRequiredString(value.label, `${path}.label`, {
          trim: true,
          valueMessage: 'label must be a non-empty string.'
        }),
        ...validateRequiredBoolean(value.checked, `${path}.checked`).map((issue) => ({
          ...issue,
          message: 'checked must be a boolean.'
        }))
      ]

      if (resolved) {
        issues.push(
          ...validateOptionalString(value.callbackId, `${path}.callbackId`, {
            minLength: 1,
            trim: true,
            typeMessage: 'callbackId must be a string when provided.',
            valueMessage: 'callbackId must be a non-empty string when provided.'
          })
        )
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
          resolved ? RESOLVED_SELECT_MENU_ITEM_KEYS : SELECT_MENU_NODE_KEYS,
          path
        ),
        ...validateEntityMenuItemBase(value, path),
        ...validateRequiredString(value.label, `${path}.label`, {
          trim: true,
          valueMessage: 'label must be a non-empty string.'
        }),
        ...validateRequiredString(value.value, `${path}.value`, {
          minLength: 0,
          typeMessage: 'value must be a string.'
        }),
        ...validateMenuSelectOptions(value.options, `${path}.options`)
      ]

      if (resolved) {
        issues.push(
          ...validateOptionalString(value.callbackId, `${path}.callbackId`, {
            minLength: 1,
            trim: true,
            typeMessage: 'callbackId must be a string when provided.',
            valueMessage: 'callbackId must be a non-empty string when provided.'
          })
        )
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

    case 'separator':
      return [
        ...validateUnknownKeys(value, SEPARATOR_MENU_NODE_KEYS, path),
        ...validateRequiredString(value.id, `${path}.id`, {
          trim: true,
          valueMessage: 'Menu item id must be a non-empty string.'
        })
      ]

    default:
      return [
        {
          path: `${path}.kind`,
          message: 'Unknown entity menu node kind.'
        }
      ]
  }
}

function validateEntityMenuNodeArray(
  value: unknown,
  resolved: boolean,
  path = '$'
): ValidationIssue[] {
  const issues = validateRequiredArray(value, path, {
    typeMessage: 'Entity menu nodes must be an array.'
  })

  if (!Array.isArray(value)) {
    return issues
  }

  const seenIds = new Set<string>()
  for (const [index, node] of value.entries()) {
    const nodePath = `${path}[${index}]`
    issues.push(...validateEntityMenuNodeLike(node, nodePath, resolved))

    if (isPlainObject(node) && typeof node.id === 'string') {
      if (seenIds.has(node.id)) {
        issues.push({
          path: `${nodePath}.id`,
          message: 'Menu item id must be unique within a contribution.'
        })
      }
      seenIds.add(node.id)
    }
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
  return validateEntityMenuNodeLike(value, '$', false)
}

export function validateEntityMenuNodes(value: unknown): ValidationIssue[] {
  return validateEntityMenuNodeArray(value, false)
}

export function validateEntityMenuItem(value: unknown): ValidationIssue[] {
  return validateEntityMenuNodeLike(value, '$', true)
}

export function validateEntityMenuItems(value: unknown): ValidationIssue[] {
  return validateEntityMenuNodeArray(value, true)
}

export function isEntityMenuContribution(value: unknown): value is EntityMenuContribution {
  return validateEntityMenuContributionShape(value).length === 0
}
