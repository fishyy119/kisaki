import type { MaybePromise, JsonObject } from '../../../shared'
import type { SettingsPanelNodeWidth } from './shared'

export interface SettingsPanelNodeEvents<TChangeEvent, TChangeResult, TButtonEvent, TButtonResult> {
  changeEvent: TChangeEvent
  changeResult: TChangeResult
  buttonEvent: TButtonEvent
  buttonResult: TButtonResult
}

export interface SettingsPanelFieldHelp {
  text: string
  icon?: string
}

export interface SettingsPanelFieldLink {
  href: string
  label: string
  icon?: string
}

export interface SettingsPanelField<TEvents extends SettingsPanelAnyNodeEvents> {
  id: string
  label?: string
  description?: string
  help?: SettingsPanelFieldHelp
  link?: SettingsPanelFieldLink
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
  TChangeEvent,
  TChangeResult
> extends SettingsPanelNodeBase {
  initialValue: TValue
  onChange?: (event: TChangeEvent) => MaybePromise<TChangeResult>
}

export interface SettingsPanelSwitchNode<
  TChangeEvent,
  TChangeResult
> extends SettingsPanelValueNodeBase<boolean, TChangeEvent, TChangeResult> {
  kind: 'switch'
}

export interface SettingsPanelCheckboxNode<
  TChangeEvent,
  TChangeResult
> extends SettingsPanelValueNodeBase<boolean, TChangeEvent, TChangeResult> {
  kind: 'checkbox'
}

export interface SettingsPanelSelectNode<
  TChangeEvent,
  TChangeResult
> extends SettingsPanelValueNodeBase<string, TChangeEvent, TChangeResult> {
  kind: 'select'
  placeholder?: string
  options: readonly SettingsPanelSelectOption[]
}

export interface SettingsPanelRadioGroupNode<
  TChangeEvent,
  TChangeResult
> extends SettingsPanelValueNodeBase<string, TChangeEvent, TChangeResult> {
  kind: 'radioGroup'
  orientation?: 'vertical' | 'horizontal'
  options: readonly SettingsPanelSelectOption[]
}

export interface SettingsPanelMultiSelectNode<
  TChangeEvent,
  TChangeResult
> extends SettingsPanelValueNodeBase<readonly string[], TChangeEvent, TChangeResult> {
  kind: 'multiSelect'
  options: readonly SettingsPanelSelectOption[]
}

export interface SettingsPanelTextInputNode<
  TChangeEvent,
  TChangeResult
> extends SettingsPanelValueNodeBase<string, TChangeEvent, TChangeResult> {
  kind: 'textInput'
  placeholder?: string
  inputMode?: 'text' | 'email' | 'url' | 'search' | 'tel' | 'password'
}

export interface SettingsPanelTextareaNode<
  TChangeEvent,
  TChangeResult
> extends SettingsPanelValueNodeBase<string, TChangeEvent, TChangeResult> {
  kind: 'textarea'
  placeholder?: string
  rows?: number
}

export interface SettingsPanelNumberInputNode<
  TChangeEvent,
  TChangeResult
> extends SettingsPanelValueNodeBase<number, TChangeEvent, TChangeResult> {
  kind: 'numberInput'
  placeholder?: string
  min?: number
  max?: number
  step?: number
}

export interface SettingsPanelStringListNode<
  TChangeEvent,
  TChangeResult
> extends SettingsPanelValueNodeBase<readonly string[], TChangeEvent, TChangeResult> {
  kind: 'stringList'
  addPlaceholder?: string
  itemPlaceholder?: string
}

export interface SettingsPanelRecordListNode<
  TChangeEvent,
  TChangeResult
> extends SettingsPanelValueNodeBase<readonly JsonObject[], TChangeEvent, TChangeResult> {
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
  rows: readonly JsonObject[]
  emptyLabel?: string
}

export type SettingsPanelComparisonTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface SettingsPanelComparisonSummaryItem {
  label: string
  value: string
  tone?: SettingsPanelComparisonTone
}

export interface SettingsPanelComparisonLink {
  label: string
  href: string
}

export interface SettingsPanelComparisonBadge {
  label: string
  tone?: SettingsPanelComparisonTone
}

export interface SettingsPanelComparisonRow {
  label: string
  before: string
  after: string
  tone?: SettingsPanelComparisonTone
}

export interface SettingsPanelComparisonGroup {
  id: string
  title: string
  subtitle?: string
  link?: SettingsPanelComparisonLink
  badges?: readonly SettingsPanelComparisonBadge[]
  rows: readonly SettingsPanelComparisonRow[]
}

export interface SettingsPanelComparisonListNode extends SettingsPanelNodeBase {
  kind: 'comparisonList'
  title?: string
  summary?: readonly SettingsPanelComparisonSummaryItem[]
  groups: readonly SettingsPanelComparisonGroup[]
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
  | SettingsPanelSwitchNode<TEvents['changeEvent'], TEvents['changeResult']>
  | SettingsPanelCheckboxNode<TEvents['changeEvent'], TEvents['changeResult']>
  | SettingsPanelSelectNode<TEvents['changeEvent'], TEvents['changeResult']>
  | SettingsPanelRadioGroupNode<TEvents['changeEvent'], TEvents['changeResult']>
  | SettingsPanelMultiSelectNode<TEvents['changeEvent'], TEvents['changeResult']>
  | SettingsPanelTextInputNode<TEvents['changeEvent'], TEvents['changeResult']>
  | SettingsPanelTextareaNode<TEvents['changeEvent'], TEvents['changeResult']>
  | SettingsPanelNumberInputNode<TEvents['changeEvent'], TEvents['changeResult']>
  | SettingsPanelStringListNode<TEvents['changeEvent'], TEvents['changeResult']>
  | SettingsPanelRecordListNode<TEvents['changeEvent'], TEvents['changeResult']>

export type SettingsPanelActionNode<TEvents extends SettingsPanelAnyNodeEvents> =
  SettingsPanelButtonNode<TEvents['buttonEvent'], TEvents['buttonResult']>

export type SettingsPanelDisplayNode =
  | SettingsPanelTextNode
  | SettingsPanelNoticeNode
  | SettingsPanelStatusNode
  | SettingsPanelTableNode
  | SettingsPanelComparisonListNode
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
