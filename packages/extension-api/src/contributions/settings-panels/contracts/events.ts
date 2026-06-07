import type { JsonObject, JsonValue } from '../../../shared'
import type { SettingsPanelDialogMap, SettingsPanelPopoverMap } from './definitions'
import type { SettingsPanelNodeEvents } from './nodes'
import type {
  SettingsPanelDialogButtonHelpers,
  SettingsPanelDialogButtonResult,
  SettingsPanelDialogChangeHelpers,
  SettingsPanelDialogChangeResult,
  SettingsPanelDialogSubmitHelpers,
  SettingsPanelPopoverActionHelpers,
  SettingsPanelPopoverButtonResult,
  SettingsPanelPopoverChangeResult,
  SettingsPanelRootButtonHelpers,
  SettingsPanelRootButtonResult,
  SettingsPanelRootChangeHelpers,
  SettingsPanelRootChangeResult,
  SettingsPanelRootSubmitHelpers
} from './results'
import type { SettingsPanelRefreshReason } from './shared'

export type SettingsPanelRootNodeEvents<
  TPopovers extends SettingsPanelPopoverMap,
  TDialogs extends SettingsPanelDialogMap<TPopovers>
> = SettingsPanelNodeEvents<
  SettingsPanelRootChangeEvent,
  SettingsPanelRootChangeResult,
  SettingsPanelRootButtonClickEvent<TPopovers, TDialogs>,
  SettingsPanelRootButtonResult<TPopovers, TDialogs>
>

export type SettingsPanelDialogNodeEvents<
  TParams extends JsonObject,
  TPopovers extends SettingsPanelPopoverMap
> = SettingsPanelNodeEvents<
  SettingsPanelDialogChangeEvent<TParams>,
  SettingsPanelDialogChangeResult,
  SettingsPanelDialogButtonClickEvent<TParams, TPopovers>,
  SettingsPanelDialogButtonResult<TPopovers>
>

export type SettingsPanelPopoverNodeEvents<TParams extends JsonObject> = SettingsPanelNodeEvents<
  SettingsPanelPopoverChangeEvent<TParams>,
  SettingsPanelPopoverChangeResult,
  SettingsPanelPopoverButtonClickEvent<TParams>,
  SettingsPanelPopoverButtonResult
>

export interface SettingsPanelResolveContextBase {
  contributionId: string
  sessionId: string
  values: JsonObject
  dirtyNodeIds: readonly string[]
  reason?: SettingsPanelRefreshReason
  signal: AbortSignal
}

export interface SettingsPanelRootResolveContext extends SettingsPanelResolveContextBase {
  surface: 'root'
}

export interface SettingsPanelDialogResolveContext<
  TParams extends JsonObject = JsonObject
> extends SettingsPanelResolveContextBase {
  surface: 'dialog'
  dialogId: string
  params: TParams
  parentValues: JsonObject
  parentDirtyNodeIds: readonly string[]
}

export interface SettingsPanelPopoverResolveContext<
  TParams extends JsonObject = JsonObject
> extends SettingsPanelResolveContextBase {
  surface: 'popover'
  popoverId: string
  params: TParams
  parent: { surface: 'root' } | { surface: 'dialog'; dialogId: string }
  parentValues: JsonObject
  parentDirtyNodeIds: readonly string[]
}

export interface SettingsPanelChangeEventBase {
  fieldId: string
  nodeId: string
  value: JsonValue
}

export interface SettingsPanelButtonClickEventBase {
  fieldId: string
  nodeId: string
}

export type SettingsPanelRootChangeEvent = SettingsPanelRootResolveContext &
  SettingsPanelRootChangeHelpers &
  SettingsPanelChangeEventBase

export type SettingsPanelDialogChangeEvent<TParams extends JsonObject = JsonObject> =
  SettingsPanelDialogResolveContext<TParams> &
    SettingsPanelDialogChangeHelpers &
    SettingsPanelChangeEventBase

export type SettingsPanelPopoverChangeEvent<TParams extends JsonObject = JsonObject> =
  SettingsPanelPopoverResolveContext<TParams> &
    SettingsPanelPopoverActionHelpers &
    SettingsPanelChangeEventBase

export type SettingsPanelRootButtonClickEvent<
  TPopovers extends SettingsPanelPopoverMap = SettingsPanelPopoverMap,
  TDialogs extends SettingsPanelDialogMap<TPopovers> = SettingsPanelDialogMap<TPopovers>
> = SettingsPanelRootResolveContext &
  SettingsPanelRootButtonHelpers<TPopovers, TDialogs> &
  SettingsPanelButtonClickEventBase

export type SettingsPanelDialogButtonClickEvent<
  TParams extends JsonObject = JsonObject,
  TPopovers extends SettingsPanelPopoverMap = SettingsPanelPopoverMap
> = SettingsPanelDialogResolveContext<TParams> &
  SettingsPanelDialogButtonHelpers<TPopovers> &
  SettingsPanelButtonClickEventBase

export type SettingsPanelPopoverButtonClickEvent<TParams extends JsonObject = JsonObject> =
  SettingsPanelPopoverResolveContext<TParams> &
    SettingsPanelPopoverActionHelpers &
    SettingsPanelButtonClickEventBase

export interface SettingsPanelRootSubmitEvent
  extends SettingsPanelRootResolveContext, SettingsPanelRootSubmitHelpers {}

export interface SettingsPanelDialogSubmitEvent<TParams extends JsonObject = JsonObject>
  extends SettingsPanelDialogResolveContext<TParams>, SettingsPanelDialogSubmitHelpers {}
