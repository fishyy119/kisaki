import type { Disposable, MaybePromise, SerializableRecord } from '../../../shared'
import type {
  SettingsPanelDialogNodeEvents,
  SettingsPanelDialogResolveContext,
  SettingsPanelDialogSubmitEvent,
  SettingsPanelPopoverNodeEvents,
  SettingsPanelPopoverResolveContext,
  SettingsPanelRootNodeEvents,
  SettingsPanelRootResolveContext,
  SettingsPanelRootSubmitEvent
} from './events'
import type { SettingsPanelNodeFactory } from './factory'
import type {
  SettingsPanelDialogModel,
  SettingsPanelPopoverModel,
  SettingsPanelRootModel
} from './models'
import type { SettingsPanelAnyNodeEvents, SettingsPanelTab } from './nodes'
import type { SettingsPanelDialogSubmitResult, SettingsPanelRootSubmitResult } from './results'
import type {
  SettingsPanelDialogSize,
  SettingsPanelPopoverWidth,
  SettingsPanelRefreshReason
} from './shared'

export interface SettingsPanelRegistration extends Disposable {
  refresh(reason?: SettingsPanelRefreshReason): Promise<void>
}

export interface SettingsPanelRegistrar {
  register<
    const TPopovers extends SettingsPanelPopoverMap = EmptySettingsPanelPopoverMap,
    const TDialogs extends SettingsPanelDialogMap<TPopovers> = EmptySettingsPanelDialogMap
  >(
    panel: SettingsPanelContribution<TPopovers, TDialogs>
  ): SettingsPanelRegistration
}

export function defineSettingsPanel<
  const TPopovers extends SettingsPanelPopoverMap = EmptySettingsPanelPopoverMap,
  const TDialogs extends SettingsPanelDialogMap<TPopovers> = EmptySettingsPanelDialogMap
>(
  contribution: SettingsPanelContribution<TPopovers, TDialogs>
): SettingsPanelContribution<TPopovers, TDialogs> {
  return contribution
}

export function defineSettingsPanelDialog<
  const TParams extends SerializableRecord = SerializableRecord,
  const TPopovers extends SettingsPanelPopoverMap = EmptySettingsPanelPopoverMap
>(
  definition: SettingsPanelDialogDefinition<TParams, TPopovers>
): SettingsPanelDialogDefinition<TParams, TPopovers> {
  return definition
}

export function defineSettingsPanelPopover<
  const TParams extends SerializableRecord = SerializableRecord
>(definition: SettingsPanelPopoverDefinition<TParams>): SettingsPanelPopoverDefinition<TParams> {
  return definition
}

export function defineSettingsPanelTab<const TEvents extends SettingsPanelAnyNodeEvents>(
  tab: SettingsPanelTab<TEvents>
): SettingsPanelTab<TEvents> {
  return tab
}

export type SettingsPanelPopoverMap = Record<string, SettingsPanelPopoverDefinition>
export type EmptySettingsPanelPopoverMap = Record<never, never>

export type SettingsPanelDialogMap<
  TPopovers extends SettingsPanelPopoverMap = SettingsPanelPopoverMap
> = Record<string, SettingsPanelDialogDefinition<SerializableRecord, TPopovers>>

export type EmptySettingsPanelDialogMap = Record<never, never>

export type SettingsPanelPopoverId<TPopovers> = Extract<keyof TPopovers, string>

export type SettingsPanelDialogId<TDialogs> = Extract<keyof TDialogs, string>

export type SettingsPanelPopoverParams<TPopover> =
  TPopover extends SettingsPanelPopoverDefinition<infer TParams> ? TParams : SerializableRecord

export type SettingsPanelDialogParams<TDialog> =
  TDialog extends SettingsPanelDialogDefinition<infer TParams, infer _TPopovers>
    ? TParams
    : SerializableRecord

export interface SettingsPanelContribution<
  TPopovers extends SettingsPanelPopoverMap = EmptySettingsPanelPopoverMap,
  TDialogs extends SettingsPanelDialogMap<TPopovers> = EmptySettingsPanelDialogMap
> {
  id: string
  title: string
  description?: string
  order?: number
  submitLabel?: string
  popovers?: TPopovers & SettingsPanelPopoverMap
  dialogs?: TDialogs & SettingsPanelDialogMap<TPopovers>
  resolve(
    context: SettingsPanelRootResolveContext,
    settings: SettingsPanelNodeFactory<SettingsPanelRootNodeEvents<TPopovers, TDialogs>>
  ): MaybePromise<SettingsPanelRootModel<TPopovers, TDialogs>>
  submit?(event: SettingsPanelRootSubmitEvent): MaybePromise<SettingsPanelRootSubmitResult>
}

export interface SettingsPanelDialogDefinition<
  TParams extends SerializableRecord = SerializableRecord,
  TPopovers extends SettingsPanelPopoverMap = EmptySettingsPanelPopoverMap
> {
  title?: string
  size?: SettingsPanelDialogSize
  submitLabel?: string
  resolve(
    context: SettingsPanelDialogResolveContext<TParams>,
    settings: SettingsPanelNodeFactory<SettingsPanelDialogNodeEvents<TParams, TPopovers>>
  ): MaybePromise<SettingsPanelDialogModel<TParams, TPopovers>>
  submit?(
    event: SettingsPanelDialogSubmitEvent<TParams>
  ): MaybePromise<SettingsPanelDialogSubmitResult>
}

export interface SettingsPanelPopoverDefinition<
  TParams extends SerializableRecord = SerializableRecord
> {
  title?: string
  width?: SettingsPanelPopoverWidth
  resolve(
    context: SettingsPanelPopoverResolveContext<TParams>,
    settings: SettingsPanelNodeFactory<SettingsPanelPopoverNodeEvents<TParams>>
  ): MaybePromise<SettingsPanelPopoverModel<TParams>>
}
