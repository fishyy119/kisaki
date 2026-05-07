import type { Disposable, MaybePromise, SerializableRecord } from '../../../shared'
import type {
  SettingsDialogNodeEvents,
  SettingsDialogResolveContext,
  SettingsDialogSubmitEvent,
  SettingsPopoverNodeEvents,
  SettingsPopoverResolveContext,
  SettingsRootNodeEvents,
  SettingsRootResolveContext,
  SettingsRootSubmitEvent
} from './events'
import type { SettingsNodeFactory } from './factory'
import type { SettingsDialogModel, SettingsPopoverModel, SettingsRootModel } from './models'
import type { SettingsDialogSubmitResult, SettingsRootSubmitResult } from './results'
import type { SettingsDialogSize, SettingsPopoverWidth, SettingsRefreshReason } from './shared'

export interface SettingsRegistration extends Disposable {
  refresh(reason?: SettingsRefreshReason): Promise<void>
}

export interface SettingsRegistrar {
  register<
    const TPopovers extends SettingsPopoverMap = EmptySettingsPopoverMap,
    const TDialogs extends SettingsDialogMap<TPopovers> = EmptySettingsDialogMap
  >(
    contribution: SettingsContribution<TPopovers, TDialogs>
  ): SettingsRegistration
}

export function defineSettingsContribution<
  const TPopovers extends SettingsPopoverMap = EmptySettingsPopoverMap,
  const TDialogs extends SettingsDialogMap<TPopovers> = EmptySettingsDialogMap
>(
  contribution: SettingsContribution<TPopovers, TDialogs>
): SettingsContribution<TPopovers, TDialogs> {
  return contribution
}

export type SettingsPopoverMap = Record<string, SettingsPopoverDefinition>
export type EmptySettingsPopoverMap = Record<never, never>

export type SettingsDialogMap<TPopovers extends SettingsPopoverMap = SettingsPopoverMap> = Record<
  string,
  SettingsDialogDefinition<SerializableRecord, TPopovers>
>

export type EmptySettingsDialogMap = Record<never, never>

export type SettingsPopoverId<TPopovers> = Extract<keyof TPopovers, string>

export type SettingsDialogId<TDialogs> = Extract<keyof TDialogs, string>

export type SettingsPopoverParams<TPopover> =
  TPopover extends SettingsPopoverDefinition<infer TParams> ? TParams : SerializableRecord

export type SettingsDialogParams<TDialog> =
  TDialog extends SettingsDialogDefinition<infer TParams, infer _TPopovers>
    ? TParams
    : SerializableRecord

export interface SettingsContribution<
  TPopovers extends SettingsPopoverMap = EmptySettingsPopoverMap,
  TDialogs extends SettingsDialogMap<TPopovers> = EmptySettingsDialogMap
> {
  id: string
  title: string
  description?: string
  order?: number
  popovers?: TPopovers & SettingsPopoverMap
  dialogs?: TDialogs & SettingsDialogMap<TPopovers>
  resolve(
    context: SettingsRootResolveContext,
    settings: SettingsNodeFactory<SettingsRootNodeEvents<TPopovers, TDialogs>>
  ): MaybePromise<SettingsRootModel<TPopovers, TDialogs>>
  submit?(event: SettingsRootSubmitEvent): MaybePromise<SettingsRootSubmitResult>
}

export interface SettingsDialogDefinition<
  TParams extends SerializableRecord = SerializableRecord,
  TPopovers extends SettingsPopoverMap = EmptySettingsPopoverMap
> {
  title?: string
  size?: SettingsDialogSize
  resolve(
    context: SettingsDialogResolveContext<TParams>,
    settings: SettingsNodeFactory<SettingsDialogNodeEvents<TParams, TPopovers>>
  ): MaybePromise<SettingsDialogModel<TParams, TPopovers>>
  submit?(event: SettingsDialogSubmitEvent<TParams>): MaybePromise<SettingsDialogSubmitResult>
}

export interface SettingsPopoverDefinition<
  TParams extends SerializableRecord = SerializableRecord
> {
  title?: string
  width?: SettingsPopoverWidth
  resolve(
    context: SettingsPopoverResolveContext<TParams>,
    settings: SettingsNodeFactory<SettingsPopoverNodeEvents<TParams>>
  ): MaybePromise<SettingsPopoverModel<TParams>>
}
