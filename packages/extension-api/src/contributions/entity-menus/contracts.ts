import type {
  ContributionIcon,
  Disposable,
  MaybePromise,
  JsonObject,
  UiCallbackResult
} from '../../shared'

export interface EntityMenuRefreshReason {
  reason?: string
  params?: JsonObject
}

export interface EntityMenuInputBase {
  domain: EntityMenuDomain
  scope: string
}

export interface EntityMenuGameSingleInput extends EntityMenuInputBase {
  domain: 'game'
  scope: 'single'
  entityId: string
}

export interface EntityMenuGameBatchInput extends EntityMenuInputBase {
  domain: 'game'
  scope: 'batch'
  entityIds: readonly string[]
}

export interface EntityMenuAnimeSingleInput extends EntityMenuInputBase {
  domain: 'anime'
  scope: 'single'
  entityId: string
}

export interface EntityMenuAnimeBatchInput extends EntityMenuInputBase {
  domain: 'anime'
  scope: 'batch'
  entityIds: readonly string[]
}

export interface EntityMenuComicSingleInput extends EntityMenuInputBase {
  domain: 'comic'
  scope: 'single'
  entityId: string
}

export interface EntityMenuComicBatchInput extends EntityMenuInputBase {
  domain: 'comic'
  scope: 'batch'
  entityIds: readonly string[]
}

export interface EntityMenuNovelSingleInput extends EntityMenuInputBase {
  domain: 'novel'
  scope: 'single'
  entityId: string
}

export interface EntityMenuNovelBatchInput extends EntityMenuInputBase {
  domain: 'novel'
  scope: 'batch'
  entityIds: readonly string[]
}

export interface EntityMenuCharacterSingleInput extends EntityMenuInputBase {
  domain: 'character'
  scope: 'single'
  entityId: string
}

export interface EntityMenuPersonSingleInput extends EntityMenuInputBase {
  domain: 'person'
  scope: 'single'
  entityId: string
}

export interface EntityMenuCompanySingleInput extends EntityMenuInputBase {
  domain: 'company'
  scope: 'single'
  entityId: string
}

export interface EntityMenuCollectionSingleInput extends EntityMenuInputBase {
  domain: 'collection'
  scope: 'single'
  entityId: string
}

export interface EntityMenuTagSingleInput extends EntityMenuInputBase {
  domain: 'tag'
  scope: 'single'
  entityId: string
}

export interface EntityMenuInputMap {
  game: {
    single: EntityMenuGameSingleInput
    batch: EntityMenuGameBatchInput
  }
  anime: {
    single: EntityMenuAnimeSingleInput
    batch: EntityMenuAnimeBatchInput
  }
  comic: {
    single: EntityMenuComicSingleInput
    batch: EntityMenuComicBatchInput
  }
  novel: {
    single: EntityMenuNovelSingleInput
    batch: EntityMenuNovelBatchInput
  }
  character: {
    single: EntityMenuCharacterSingleInput
  }
  person: {
    single: EntityMenuPersonSingleInput
  }
  company: {
    single: EntityMenuCompanySingleInput
  }
  collection: {
    single: EntityMenuCollectionSingleInput
  }
  tag: {
    single: EntityMenuTagSingleInput
  }
}

export type EntityMenuDomain = keyof EntityMenuInputMap
export type EntityMenuScope<TDomain extends EntityMenuDomain> = Extract<
  keyof EntityMenuInputMap[TDomain],
  string
>

export type EntityMenuInput = {
  [
    TDomain in keyof EntityMenuInputMap
  ]: EntityMenuInputMap[TDomain][keyof EntityMenuInputMap[TDomain]]
}[keyof EntityMenuInputMap]

export type EntityMenuInputFor<
  TDomain extends EntityMenuDomain,
  TScope extends EntityMenuScope<TDomain>
> = EntityMenuInputMap[TDomain][TScope] extends EntityMenuInput
  ? EntityMenuInputMap[TDomain][TScope]
  : never

export type EntityMenuRegistrar = {
  [TDomain in EntityMenuDomain]: {
    [TScope in EntityMenuScope<TDomain>]: EntityMenuRegistrationPoint<
      EntityMenuInputFor<TDomain, TScope>
    >
  }
}

export interface EntityMenuContribution<TInput extends EntityMenuInput> {
  id: string
  order?: number
  resolve(
    input: TInput,
    menu: EntityMenuNodeFactory<TInput>
  ): MaybePromise<readonly EntityMenuNode<TInput>[]>
}

export interface EntityMenuRegistrationPoint<TInput extends EntityMenuInput> {
  register(menu: EntityMenuContribution<TInput>): EntityMenuRegistration
}

export interface EntityMenuRegistration extends Disposable {
  refresh(reason?: EntityMenuRefreshReason): Promise<void>
}

export interface EntityMenuNodeBase {
  id: string
  hidden?: boolean
  disabled?: boolean
}

export interface EntityMenuActionNode<
  TInput extends EntityMenuInput = EntityMenuInput
> extends EntityMenuNodeBase {
  kind: 'action'
  label: string
  icon?: ContributionIcon
  tone?: 'default' | 'danger'
  shortcut?: string
  onClick(event: EntityMenuNodeEvent<TInput>): MaybePromise<UiCallbackResult>
}

export interface EntityMenuCheckboxNode<
  TInput extends EntityMenuInput = EntityMenuInput
> extends EntityMenuNodeBase {
  kind: 'checkbox'
  label: string
  icon?: ContributionIcon
  checked: boolean
  onChange(checked: boolean, event: EntityMenuNodeEvent<TInput>): MaybePromise<UiCallbackResult>
}

export interface EntityMenuSelectNode<
  TInput extends EntityMenuInput = EntityMenuInput
> extends EntityMenuNodeBase {
  kind: 'select'
  label: string
  icon?: ContributionIcon
  value: string
  options: readonly EntityMenuSelectOption[]
  onChange(value: string, event: EntityMenuNodeEvent<TInput>): MaybePromise<UiCallbackResult>
}

export interface EntityMenuSubmenuNode<
  TInput extends EntityMenuInput = EntityMenuInput
> extends EntityMenuNodeBase {
  kind: 'submenu'
  label: string
  icon?: ContributionIcon
  children: readonly EntityMenuNode<TInput>[]
}

export interface EntityMenuSeparatorNode {
  kind: 'separator'
  id?: string
  hidden?: boolean
}

export type EntityMenuNode<TInput extends EntityMenuInput = EntityMenuInput> =
  | EntityMenuActionNode<TInput>
  | EntityMenuCheckboxNode<TInput>
  | EntityMenuSelectNode<TInput>
  | EntityMenuSubmenuNode<TInput>
  | EntityMenuSeparatorNode

export interface EntityMenuSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface EntityMenuNodeEvent<TInput extends EntityMenuInput = EntityMenuInput> {
  input: TInput
  nodeId: string
  nodePath: readonly string[]
}

export interface EntityMenuNodeFactory<TInput extends EntityMenuInput = EntityMenuInput> {
  action(node: Omit<EntityMenuActionNode<TInput>, 'kind'>): EntityMenuActionNode<TInput>
  checkbox(node: Omit<EntityMenuCheckboxNode<TInput>, 'kind'>): EntityMenuCheckboxNode<TInput>
  select(node: Omit<EntityMenuSelectNode<TInput>, 'kind'>): EntityMenuSelectNode<TInput>
  submenu(node: Omit<EntityMenuSubmenuNode<TInput>, 'kind'>): EntityMenuSubmenuNode<TInput>
  separator(node?: Omit<EntityMenuSeparatorNode, 'kind'>): EntityMenuSeparatorNode
}
