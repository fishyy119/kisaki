import type { MaybePromise, SerializableRecord } from '../../../shared'
import type { SettingsNodeWidth } from './shared'

export interface SettingsNodeEvents<TCommitEvent, TCommitResult, TButtonEvent, TButtonResult> {
  commitEvent: TCommitEvent
  commitResult: TCommitResult
  buttonEvent: TButtonEvent
  buttonResult: TButtonResult
}

export interface SettingsField<TEvents extends SettingsAnyNodeEvents> {
  id: string
  label?: string
  description?: string
  hidden?: boolean
  disabled?: boolean
  orientation?: 'vertical' | 'horizontal' | 'responsive'
  span?: 1 | 2 | 3 | 'full'
  contentLayout?: 'stack' | 'inline' | 'grid'
  contentColumns?: 1 | 2 | 3
  content: readonly SettingsFieldContentNode<TEvents>[]
}

export interface SettingsTab<TEvents extends SettingsAnyNodeEvents> {
  id: string
  label: string
  description?: string
  icon?: string
  fields: readonly SettingsField<TEvents>[]
}

export interface SettingsNodeBase {
  id: string
  hidden?: boolean
  disabled?: boolean
  grow?: boolean
  width?: SettingsNodeWidth
}

export interface SettingsValueNodeBase<
  TValue,
  TCommitEvent,
  TCommitResult
> extends SettingsNodeBase {
  initialValue: TValue
  onCommit?: (event: TCommitEvent) => MaybePromise<TCommitResult>
}

export interface SettingsSwitchNode<TCommitEvent, TCommitResult> extends SettingsValueNodeBase<
  boolean,
  TCommitEvent,
  TCommitResult
> {
  kind: 'switch'
}

export interface SettingsCheckboxNode<TCommitEvent, TCommitResult> extends SettingsValueNodeBase<
  boolean,
  TCommitEvent,
  TCommitResult
> {
  kind: 'checkbox'
}

export interface SettingsSelectNode<TCommitEvent, TCommitResult> extends SettingsValueNodeBase<
  string,
  TCommitEvent,
  TCommitResult
> {
  kind: 'select'
  placeholder?: string
  options: readonly SettingsSelectOption[]
}

export interface SettingsMultiSelectNode<TCommitEvent, TCommitResult> extends SettingsValueNodeBase<
  readonly string[],
  TCommitEvent,
  TCommitResult
> {
  kind: 'multiSelect'
  options: readonly SettingsSelectOption[]
}

export interface SettingsTextInputNode<TCommitEvent, TCommitResult> extends SettingsValueNodeBase<
  string,
  TCommitEvent,
  TCommitResult
> {
  kind: 'textInput'
  placeholder?: string
  inputMode?: 'text' | 'email' | 'url' | 'search' | 'tel' | 'password'
}

export interface SettingsTextareaNode<TCommitEvent, TCommitResult> extends SettingsValueNodeBase<
  string,
  TCommitEvent,
  TCommitResult
> {
  kind: 'textarea'
  placeholder?: string
  rows?: number
}

export interface SettingsNumberInputNode<TCommitEvent, TCommitResult> extends SettingsValueNodeBase<
  number,
  TCommitEvent,
  TCommitResult
> {
  kind: 'numberInput'
  placeholder?: string
  min?: number
  max?: number
  step?: number
}

export interface SettingsStringListNode<TCommitEvent, TCommitResult> extends SettingsValueNodeBase<
  readonly string[],
  TCommitEvent,
  TCommitResult
> {
  kind: 'stringList'
  addPlaceholder?: string
  itemPlaceholder?: string
}

export interface SettingsRecordListNode<TCommitEvent, TCommitResult> extends SettingsValueNodeBase<
  readonly SerializableRecord[],
  TCommitEvent,
  TCommitResult
> {
  kind: 'recordList'
  columns: readonly SettingsRecordListColumn[]
  addLabel?: string
  emptyLabel?: string
}

export interface SettingsButtonNode<TButtonEvent, TButtonResult> extends SettingsNodeBase {
  kind: 'button'
  label: string
  icon?: string
  tone?: 'default' | 'primary' | 'danger'
  onClick?: (event: TButtonEvent) => MaybePromise<TButtonResult>
}

export interface SettingsTextNode extends SettingsNodeBase {
  kind: 'text'
  text: string
  tone?: 'default' | 'muted' | 'danger'
}

export interface SettingsNoticeNode extends SettingsNodeBase {
  kind: 'notice'
  tone: 'info' | 'warning' | 'error' | 'success'
  text: string
}

export interface SettingsStatusNode extends SettingsNodeBase {
  kind: 'status'
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
  label?: string
  value: string
}

export interface SettingsTableNode extends SettingsNodeBase {
  kind: 'table'
  title?: string
  columns?: readonly SettingsTableColumn[]
  rows: readonly SerializableRecord[]
  emptyLabel?: string
}

export interface SettingsImageNode extends SettingsNodeBase {
  kind: 'image'
  src: string
  alt?: string
  fit?: 'contain' | 'cover'
}

export interface SettingsDividerNode extends SettingsNodeBase {
  kind: 'divider'
}

export type SettingsControlNode<TEvents extends SettingsAnyNodeEvents> =
  | SettingsSwitchNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsCheckboxNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsSelectNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsMultiSelectNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsTextInputNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsTextareaNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsNumberInputNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsStringListNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsRecordListNode<TEvents['commitEvent'], TEvents['commitResult']>

export type SettingsActionNode<TEvents extends SettingsAnyNodeEvents> = SettingsButtonNode<
  TEvents['buttonEvent'],
  TEvents['buttonResult']
>

export type SettingsDisplayNode =
  | SettingsTextNode
  | SettingsNoticeNode
  | SettingsStatusNode
  | SettingsTableNode
  | SettingsImageNode
  | SettingsDividerNode

export type SettingsFieldContentNode<TEvents extends SettingsAnyNodeEvents> =
  | SettingsControlNode<TEvents>
  | SettingsActionNode<TEvents>
  | SettingsDisplayNode

export type SettingsAnyNodeEvents = SettingsNodeEvents<unknown, unknown, unknown, unknown>

export interface SettingsSelectOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export interface SettingsTableColumn {
  key: string
  label: string
  kind?: 'text' | 'number' | 'boolean' | 'badge'
}

export interface SettingsRecordListColumn {
  key: string
  label: string
  kind?: 'text' | 'select' | 'number' | 'boolean'
  options?: readonly SettingsSelectOption[]
}
