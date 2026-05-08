import type { Disposable, MaybePromise, SerializableRecord, UiCallbackResult } from '../../shared'

export interface MenuRefreshReason {
  reason?: string
  params?: SerializableRecord
}

export interface MenuInputBase {
  domain: MenuDomain
  scope: string
}

export interface GameSingleMenuInput extends MenuInputBase {
  domain: 'game'
  scope: 'single'
  entityId: string
}

export interface GameBatchMenuInput extends MenuInputBase {
  domain: 'game'
  scope: 'batch'
  entityIds: readonly string[]
}

export interface CharacterSingleMenuInput extends MenuInputBase {
  domain: 'character'
  scope: 'single'
  entityId: string
}

export interface PersonSingleMenuInput extends MenuInputBase {
  domain: 'person'
  scope: 'single'
  entityId: string
}

export interface CompanySingleMenuInput extends MenuInputBase {
  domain: 'company'
  scope: 'single'
  entityId: string
}

export interface CollectionSingleMenuInput extends MenuInputBase {
  domain: 'collection'
  scope: 'single'
  entityId: string
}

export interface TagSingleMenuInput extends MenuInputBase {
  domain: 'tag'
  scope: 'single'
  entityId: string
}

export interface MenuInputMap {
  game: {
    single: GameSingleMenuInput
    batch: GameBatchMenuInput
  }
  character: {
    single: CharacterSingleMenuInput
  }
  person: {
    single: PersonSingleMenuInput
  }
  company: {
    single: CompanySingleMenuInput
  }
  collection: {
    single: CollectionSingleMenuInput
  }
  tag: {
    single: TagSingleMenuInput
  }
}

export type MenuDomain = keyof MenuInputMap
export type MenuScope<TDomain extends MenuDomain> = Extract<keyof MenuInputMap[TDomain], string>

export type MenuInput = {
  [TDomain in keyof MenuInputMap]: MenuInputMap[TDomain][keyof MenuInputMap[TDomain]]
}[keyof MenuInputMap]

export type MenuInputFor<
  TDomain extends MenuDomain,
  TScope extends MenuScope<TDomain>
> = MenuInputMap[TDomain][TScope] extends MenuInput ? MenuInputMap[TDomain][TScope] : never

export type MenuRegistrar = {
  [TDomain in MenuDomain]: {
    [TScope in MenuScope<TDomain>]: MenuRegistrationPoint<MenuInputFor<TDomain, TScope>>
  }
}

export interface MenuContribution<TInput extends MenuInput> {
  id: string
  order?: number
  resolve(input: TInput, menu: MenuNodeFactory<TInput>): MaybePromise<readonly MenuNode<TInput>[]>
}

export interface MenuRegistrationPoint<TInput extends MenuInput> {
  register(contribution: MenuContribution<TInput>): MenuRegistration
}

export interface MenuRegistration extends Disposable {
  refresh(reason?: MenuRefreshReason): Promise<void>
}

export interface MenuNodeBase {
  id: string
  hidden?: boolean
  disabled?: boolean
}

export interface MenuActionNode<TInput extends MenuInput = MenuInput> extends MenuNodeBase {
  kind: 'action'
  label: string
  icon?: string
  tone?: 'default' | 'danger'
  shortcut?: string
  onClick(event: MenuNodeEvent<TInput>): MaybePromise<UiCallbackResult>
}

export interface MenuCheckboxNode<TInput extends MenuInput = MenuInput> extends MenuNodeBase {
  kind: 'checkbox'
  label: string
  icon?: string
  checked: boolean
  onChange(checked: boolean, event: MenuNodeEvent<TInput>): MaybePromise<UiCallbackResult>
}

export interface MenuSelectNode<TInput extends MenuInput = MenuInput> extends MenuNodeBase {
  kind: 'select'
  label: string
  icon?: string
  value: string
  options: readonly MenuSelectOption[]
  onChange(value: string, event: MenuNodeEvent<TInput>): MaybePromise<UiCallbackResult>
}

export interface MenuSubmenuNode<TInput extends MenuInput = MenuInput> extends MenuNodeBase {
  kind: 'submenu'
  label: string
  icon?: string
  children: readonly MenuNode<TInput>[]
}

export interface MenuSeparatorNode {
  kind: 'separator'
  id?: string
  hidden?: boolean
}

export type MenuNode<TInput extends MenuInput = MenuInput> =
  | MenuActionNode<TInput>
  | MenuCheckboxNode<TInput>
  | MenuSelectNode<TInput>
  | MenuSubmenuNode<TInput>
  | MenuSeparatorNode

export interface MenuSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface MenuNodeEvent<TInput extends MenuInput = MenuInput> {
  input: TInput
  nodeId: string
  nodePath: readonly string[]
}

export interface MenuNodeFactory<TInput extends MenuInput = MenuInput> {
  action(node: Omit<MenuActionNode<TInput>, 'kind'>): MenuActionNode<TInput>
  checkbox(node: Omit<MenuCheckboxNode<TInput>, 'kind'>): MenuCheckboxNode<TInput>
  select(node: Omit<MenuSelectNode<TInput>, 'kind'>): MenuSelectNode<TInput>
  submenu(node: Omit<MenuSubmenuNode<TInput>, 'kind'>): MenuSubmenuNode<TInput>
  separator(node?: Omit<MenuSeparatorNode, 'kind'>): MenuSeparatorNode
}
