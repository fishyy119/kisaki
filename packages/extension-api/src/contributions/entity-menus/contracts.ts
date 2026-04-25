import type { LibraryEntityType } from '../../capabilities/library'
import type { Disposable, UiCallbackResult } from '../../shared'

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
