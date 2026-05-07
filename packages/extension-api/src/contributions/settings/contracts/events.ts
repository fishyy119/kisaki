import type { SerializableRecord, SerializableValue } from '../../../shared'
import type { SettingsDialogMap, SettingsPopoverMap } from './definitions'
import type { SettingsNodeEvents } from './nodes'
import type {
  SettingsDialogButtonHelpers,
  SettingsDialogButtonResult,
  SettingsDialogCommitHelpers,
  SettingsDialogCommitResult,
  SettingsDialogSubmitHelpers,
  SettingsPopoverActionHelpers,
  SettingsPopoverButtonResult,
  SettingsPopoverCommitResult,
  SettingsRootButtonHelpers,
  SettingsRootButtonResult,
  SettingsRootCommitHelpers,
  SettingsRootCommitResult,
  SettingsRootSubmitHelpers
} from './results'
import type { SettingsRefreshReason } from './shared'

export type SettingsRootNodeEvents<
  TPopovers extends SettingsPopoverMap,
  TDialogs extends SettingsDialogMap<TPopovers>
> = SettingsNodeEvents<
  SettingsRootCommitEvent,
  SettingsRootCommitResult,
  SettingsRootButtonClickEvent<TPopovers, TDialogs>,
  SettingsRootButtonResult<TPopovers, TDialogs>
>

export type SettingsDialogNodeEvents<
  TParams extends SerializableRecord,
  TPopovers extends SettingsPopoverMap
> = SettingsNodeEvents<
  SettingsDialogCommitEvent<TParams>,
  SettingsDialogCommitResult,
  SettingsDialogButtonClickEvent<TParams, TPopovers>,
  SettingsDialogButtonResult<TPopovers>
>

export type SettingsPopoverNodeEvents<TParams extends SerializableRecord> = SettingsNodeEvents<
  SettingsPopoverCommitEvent<TParams>,
  SettingsPopoverCommitResult,
  SettingsPopoverButtonClickEvent<TParams>,
  SettingsPopoverButtonResult
>

export interface SettingsResolveContextBase {
  contributionId: string
  sessionId: string
  values: SerializableRecord
  dirtyNodeIds: readonly string[]
  reason?: SettingsRefreshReason
  signal: AbortSignal
}

export interface SettingsRootResolveContext extends SettingsResolveContextBase {
  surface: 'root'
}

export interface SettingsDialogResolveContext<
  TParams extends SerializableRecord = SerializableRecord
> extends SettingsResolveContextBase {
  surface: 'dialog'
  dialogId: string
  params: TParams
  parentValues: SerializableRecord
  parentDirtyNodeIds: readonly string[]
}

export interface SettingsPopoverResolveContext<
  TParams extends SerializableRecord = SerializableRecord
> extends SettingsResolveContextBase {
  surface: 'popover'
  popoverId: string
  params: TParams
  parent: { surface: 'root' } | { surface: 'dialog'; dialogId: string }
  parentValues: SerializableRecord
  parentDirtyNodeIds: readonly string[]
}

export interface SettingsCommitEventBase {
  fieldId: string
  nodeId: string
  value: SerializableValue
}

export interface SettingsButtonClickEventBase {
  fieldId: string
  nodeId: string
}

export type SettingsRootCommitEvent = SettingsRootResolveContext &
  SettingsRootCommitHelpers &
  SettingsCommitEventBase

export type SettingsDialogCommitEvent<TParams extends SerializableRecord = SerializableRecord> =
  SettingsDialogResolveContext<TParams> & SettingsDialogCommitHelpers & SettingsCommitEventBase

export type SettingsPopoverCommitEvent<TParams extends SerializableRecord = SerializableRecord> =
  SettingsPopoverResolveContext<TParams> & SettingsPopoverActionHelpers & SettingsCommitEventBase

export type SettingsRootButtonClickEvent<
  TPopovers extends SettingsPopoverMap = SettingsPopoverMap,
  TDialogs extends SettingsDialogMap<TPopovers> = SettingsDialogMap<TPopovers>
> = SettingsRootResolveContext &
  SettingsRootButtonHelpers<TPopovers, TDialogs> &
  SettingsButtonClickEventBase

export type SettingsDialogButtonClickEvent<
  TParams extends SerializableRecord = SerializableRecord,
  TPopovers extends SettingsPopoverMap = SettingsPopoverMap
> = SettingsDialogResolveContext<TParams> &
  SettingsDialogButtonHelpers<TPopovers> &
  SettingsButtonClickEventBase

export type SettingsPopoverButtonClickEvent<
  TParams extends SerializableRecord = SerializableRecord
> = SettingsPopoverResolveContext<TParams> &
  SettingsPopoverActionHelpers &
  SettingsButtonClickEventBase

export interface SettingsRootSubmitEvent
  extends SettingsRootResolveContext, SettingsRootSubmitHelpers {}

export interface SettingsDialogSubmitEvent<TParams extends SerializableRecord = SerializableRecord>
  extends SettingsDialogResolveContext<TParams>, SettingsDialogSubmitHelpers {}
