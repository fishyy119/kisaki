import type { SerializableRecord, SerializableValue } from '../../../shared'
import type { SettingsPanelDialogMap, SettingsPanelPopoverMap } from './definitions'
import type { SettingsPanelNodeEvents } from './nodes'
import type {
  SettingsPanelDialogButtonHelpers,
  SettingsPanelDialogButtonResult,
  SettingsPanelDialogCommitHelpers,
  SettingsPanelDialogCommitResult,
  SettingsPanelDialogSubmitHelpers,
  SettingsPanelPopoverActionHelpers,
  SettingsPanelPopoverButtonResult,
  SettingsPanelPopoverCommitResult,
  SettingsPanelRootButtonHelpers,
  SettingsPanelRootButtonResult,
  SettingsPanelRootCommitHelpers,
  SettingsPanelRootCommitResult,
  SettingsPanelRootSubmitHelpers
} from './results'
import type { SettingsPanelRefreshReason } from './shared'

export type SettingsPanelRootNodeEvents<
  TPopovers extends SettingsPanelPopoverMap,
  TDialogs extends SettingsPanelDialogMap<TPopovers>
> = SettingsPanelNodeEvents<
  SettingsPanelRootCommitEvent,
  SettingsPanelRootCommitResult,
  SettingsPanelRootButtonClickEvent<TPopovers, TDialogs>,
  SettingsPanelRootButtonResult<TPopovers, TDialogs>
>

export type SettingsPanelDialogNodeEvents<
  TParams extends SerializableRecord,
  TPopovers extends SettingsPanelPopoverMap
> = SettingsPanelNodeEvents<
  SettingsPanelDialogCommitEvent<TParams>,
  SettingsPanelDialogCommitResult,
  SettingsPanelDialogButtonClickEvent<TParams, TPopovers>,
  SettingsPanelDialogButtonResult<TPopovers>
>

export type SettingsPanelPopoverNodeEvents<TParams extends SerializableRecord> =
  SettingsPanelNodeEvents<
    SettingsPanelPopoverCommitEvent<TParams>,
    SettingsPanelPopoverCommitResult,
    SettingsPanelPopoverButtonClickEvent<TParams>,
    SettingsPanelPopoverButtonResult
  >

export interface SettingsPanelResolveContextBase {
  contributionId: string
  sessionId: string
  values: SerializableRecord
  dirtyNodeIds: readonly string[]
  reason?: SettingsPanelRefreshReason
  signal: AbortSignal
}

export interface SettingsPanelRootResolveContext extends SettingsPanelResolveContextBase {
  surface: 'root'
}

export interface SettingsPanelDialogResolveContext<
  TParams extends SerializableRecord = SerializableRecord
> extends SettingsPanelResolveContextBase {
  surface: 'dialog'
  dialogId: string
  params: TParams
  parentValues: SerializableRecord
  parentDirtyNodeIds: readonly string[]
}

export interface SettingsPanelPopoverResolveContext<
  TParams extends SerializableRecord = SerializableRecord
> extends SettingsPanelResolveContextBase {
  surface: 'popover'
  popoverId: string
  params: TParams
  parent: { surface: 'root' } | { surface: 'dialog'; dialogId: string }
  parentValues: SerializableRecord
  parentDirtyNodeIds: readonly string[]
}

export interface SettingsPanelCommitEventBase {
  fieldId: string
  nodeId: string
  value: SerializableValue
}

export interface SettingsPanelButtonClickEventBase {
  fieldId: string
  nodeId: string
}

export type SettingsPanelRootCommitEvent = SettingsPanelRootResolveContext &
  SettingsPanelRootCommitHelpers &
  SettingsPanelCommitEventBase

export type SettingsPanelDialogCommitEvent<
  TParams extends SerializableRecord = SerializableRecord
> = SettingsPanelDialogResolveContext<TParams> &
  SettingsPanelDialogCommitHelpers &
  SettingsPanelCommitEventBase

export type SettingsPanelPopoverCommitEvent<
  TParams extends SerializableRecord = SerializableRecord
> = SettingsPanelPopoverResolveContext<TParams> &
  SettingsPanelPopoverActionHelpers &
  SettingsPanelCommitEventBase

export type SettingsPanelRootButtonClickEvent<
  TPopovers extends SettingsPanelPopoverMap = SettingsPanelPopoverMap,
  TDialogs extends SettingsPanelDialogMap<TPopovers> = SettingsPanelDialogMap<TPopovers>
> = SettingsPanelRootResolveContext &
  SettingsPanelRootButtonHelpers<TPopovers, TDialogs> &
  SettingsPanelButtonClickEventBase

export type SettingsPanelDialogButtonClickEvent<
  TParams extends SerializableRecord = SerializableRecord,
  TPopovers extends SettingsPanelPopoverMap = SettingsPanelPopoverMap
> = SettingsPanelDialogResolveContext<TParams> &
  SettingsPanelDialogButtonHelpers<TPopovers> &
  SettingsPanelButtonClickEventBase

export type SettingsPanelPopoverButtonClickEvent<
  TParams extends SerializableRecord = SerializableRecord
> = SettingsPanelPopoverResolveContext<TParams> &
  SettingsPanelPopoverActionHelpers &
  SettingsPanelButtonClickEventBase

export interface SettingsPanelRootSubmitEvent
  extends SettingsPanelRootResolveContext, SettingsPanelRootSubmitHelpers {}

export interface SettingsPanelDialogSubmitEvent<
  TParams extends SerializableRecord = SerializableRecord
>
  extends SettingsPanelDialogResolveContext<TParams>, SettingsPanelDialogSubmitHelpers {}
