import type { MaybePromise, SerializableRecord } from '../../../shared'
import type { SettingsPanelNodeWidth } from './shared'

export interface SettingsPanelNodeEvents<TCommitEvent, TCommitResult, TButtonEvent, TButtonResult> {
  commitEvent: TCommitEvent
  commitResult: TCommitResult
  buttonEvent: TButtonEvent
  buttonResult: TButtonResult
}

export interface SettingsPanelField<TEvents extends SettingsPanelAnyNodeEvents> {
  id: string
  label?: string
  description?: string
  hidden?: boolean
  disabled?: boolean
  orientation?: 'vertical' | 'horizontal' | 'responsive'
  span?: 1 | 2 | 3 | 'full'
  contentLayout?: 'stack' | 'inline' | 'grid'
  contentColumns?: 1 | 2 | 3
  content: readonly SettingsPanelFieldContentNode<TEvents>[]
}

export interface SettingsPanelTab<TEvents extends SettingsPanelAnyNodeEvents> {
  id: string
  label: string
  description?: string
  icon?: string
  fields: readonly SettingsPanelField<TEvents>[]
}

export interface SettingsPanelNodeBase {
  id: string
  hidden?: boolean
  disabled?: boolean
  grow?: boolean
  width?: SettingsPanelNodeWidth
}

export interface SettingsPanelValueNodeBase<
  TValue,
  TCommitEvent,
  TCommitResult
> extends SettingsPanelNodeBase {
  initialValue: TValue
  onCommit?: (event: TCommitEvent) => MaybePromise<TCommitResult>
}

export interface SettingsPanelSwitchNode<
  TCommitEvent,
  TCommitResult
> extends SettingsPanelValueNodeBase<boolean, TCommitEvent, TCommitResult> {
  kind: 'switch'
}

export interface SettingsPanelCheckboxNode<
  TCommitEvent,
  TCommitResult
> extends SettingsPanelValueNodeBase<boolean, TCommitEvent, TCommitResult> {
  kind: 'checkbox'
}

export interface SettingsPanelSelectNode<
  TCommitEvent,
  TCommitResult
> extends SettingsPanelValueNodeBase<string, TCommitEvent, TCommitResult> {
  kind: 'select'
  placeholder?: string
  options: readonly SettingsPanelSelectOption[]
}

export interface SettingsPanelRadioGroupNode<
  TCommitEvent,
  TCommitResult
> extends SettingsPanelValueNodeBase<string, TCommitEvent, TCommitResult> {
  kind: 'radioGroup'
  options: readonly SettingsPanelSelectOption[]
}

export interface SettingsPanelMultiSelectNode<
  TCommitEvent,
  TCommitResult
> extends SettingsPanelValueNodeBase<readonly string[], TCommitEvent, TCommitResult> {
  kind: 'multiSelect'
  options: readonly SettingsPanelSelectOption[]
}

export interface SettingsPanelTextInputNode<
  TCommitEvent,
  TCommitResult
> extends SettingsPanelValueNodeBase<string, TCommitEvent, TCommitResult> {
  kind: 'textInput'
  placeholder?: string
  inputMode?: 'text' | 'email' | 'url' | 'search' | 'tel' | 'password'
}

export interface SettingsPanelTextareaNode<
  TCommitEvent,
  TCommitResult
> extends SettingsPanelValueNodeBase<string, TCommitEvent, TCommitResult> {
  kind: 'textarea'
  placeholder?: string
  rows?: number
}

export interface SettingsPanelNumberInputNode<
  TCommitEvent,
  TCommitResult
> extends SettingsPanelValueNodeBase<number, TCommitEvent, TCommitResult> {
  kind: 'numberInput'
  placeholder?: string
  min?: number
  max?: number
  step?: number
}

export interface SettingsPanelStringListNode<
  TCommitEvent,
  TCommitResult
> extends SettingsPanelValueNodeBase<readonly string[], TCommitEvent, TCommitResult> {
  kind: 'stringList'
  addPlaceholder?: string
  itemPlaceholder?: string
}

export interface SettingsPanelRecordListNode<
  TCommitEvent,
  TCommitResult
> extends SettingsPanelValueNodeBase<readonly SerializableRecord[], TCommitEvent, TCommitResult> {
  kind: 'recordList'
  columns: readonly SettingsPanelRecordListColumn[]
  addLabel?: string
  emptyLabel?: string
}

export interface SettingsPanelButtonNode<
  TButtonEvent,
  TButtonResult
> extends SettingsPanelNodeBase {
  kind: 'button'
  label: string
  icon?: string
  tone?: 'default' | 'primary' | 'danger'
  confirm?: SettingsPanelButtonConfirmation
  onClick?: (event: TButtonEvent) => MaybePromise<TButtonResult>
}

export interface SettingsPanelTextNode extends SettingsPanelNodeBase {
  kind: 'text'
  text: string
  tone?: 'default' | 'muted' | 'danger'
}

export interface SettingsPanelNoticeNode extends SettingsPanelNodeBase {
  kind: 'notice'
  tone: 'info' | 'warning' | 'error' | 'success'
  text: string
}

export interface SettingsPanelStatusNode extends SettingsPanelNodeBase {
  kind: 'status'
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
  label?: string
  value: string
}

export interface SettingsPanelTableNode extends SettingsPanelNodeBase {
  kind: 'table'
  title?: string
  columns?: readonly SettingsPanelTableColumn[]
  rows: readonly SerializableRecord[]
  emptyLabel?: string
}

export interface SettingsPanelLinkNode extends SettingsPanelNodeBase {
  kind: 'link'
  label: string
  href: string
}

export interface SettingsPanelImageNode extends SettingsPanelNodeBase {
  kind: 'image'
  src: string
  alt?: string
  fit?: 'contain' | 'cover'
}

export interface SettingsPanelDividerNode extends SettingsPanelNodeBase {
  kind: 'divider'
}

export type SettingsPanelControlNode<TEvents extends SettingsPanelAnyNodeEvents> =
  | SettingsPanelSwitchNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsPanelCheckboxNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsPanelSelectNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsPanelRadioGroupNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsPanelMultiSelectNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsPanelTextInputNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsPanelTextareaNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsPanelNumberInputNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsPanelStringListNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsPanelRecordListNode<TEvents['commitEvent'], TEvents['commitResult']>

export type SettingsPanelActionNode<TEvents extends SettingsPanelAnyNodeEvents> =
  SettingsPanelButtonNode<TEvents['buttonEvent'], TEvents['buttonResult']>

export type SettingsPanelDisplayNode =
  | SettingsPanelTextNode
  | SettingsPanelNoticeNode
  | SettingsPanelStatusNode
  | SettingsPanelTableNode
  | SettingsPanelLinkNode
  | SettingsPanelImageNode
  | SettingsPanelDividerNode

export type SettingsPanelFieldContentNode<TEvents extends SettingsPanelAnyNodeEvents> =
  | SettingsPanelControlNode<TEvents>
  | SettingsPanelActionNode<TEvents>
  | SettingsPanelDisplayNode

export type SettingsPanelAnyNodeEvents = SettingsPanelNodeEvents<unknown, unknown, unknown, unknown>

export interface SettingsPanelSelectOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export interface SettingsPanelTableColumn {
  key: string
  label: string
  kind?: 'text' | 'number' | 'boolean' | 'badge' | 'link'
  truncate?: boolean
  weight?: number
}

export interface SettingsPanelRecordListColumn {
  key: string
  label: string
  kind?: 'text' | 'select' | 'number' | 'boolean'
  options?: readonly SettingsPanelSelectOption[]
}

export interface SettingsPanelButtonConfirmation {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
}
