import type { ExtensionErrorShape } from '../../../shared'
import type {
  SettingsPanelDialogId,
  SettingsPanelDialogMap,
  SettingsPanelDialogParams,
  SettingsPanelPopoverId,
  SettingsPanelPopoverMap,
  SettingsPanelPopoverParams
} from './definitions'
import type {
  SettingsPanelCloseOptions,
  SettingsPanelClosePopoverOptions,
  SettingsPanelFailureOptions,
  SettingsPanelOpenOptions,
  SettingsPanelRefreshTarget,
  SettingsPanelSuccessOptions
} from './shared'

export interface SettingsPanelDialogTarget<
  TDialogs,
  TDialogId extends SettingsPanelDialogId<TDialogs> = SettingsPanelDialogId<TDialogs>
> {
  dialogId: TDialogId
  params?: SettingsPanelDialogParams<TDialogs[TDialogId]>
}

export interface SettingsPanelPopoverTarget<
  TPopovers,
  TPopoverId extends SettingsPanelPopoverId<TPopovers> = SettingsPanelPopoverId<TPopovers>
> {
  popoverId: TPopoverId
  params?: SettingsPanelPopoverParams<TPopovers[TPopoverId]>
}

export type SettingsPanelResult<
  TEffect extends object = Record<never, never>,
  TFailureRefresh extends SettingsPanelRefreshTarget = SettingsPanelRefreshTarget
> =
  | ({ success: true; message?: string } & TEffect)
  | {
      success: false
      error: ExtensionErrorShape
      refresh?: TFailureRefresh
      closePopover?: boolean
    }

export type SettingsPanelRootCommitResult = SettingsPanelResult<
  {
    refresh?: 'self' | 'root' | 'all'
    closePopover?: boolean
  },
  'self' | 'root' | 'all'
>

export type SettingsPanelDialogCommitResult = SettingsPanelResult<
  {
    refresh?: 'self' | 'dialog' | 'root' | 'all'
    closePopover?: boolean
  },
  'self' | 'dialog' | 'root' | 'all'
>

export type SettingsPanelRootButtonEffect<
  TPopovers extends SettingsPanelPopoverMap = SettingsPanelPopoverMap,
  TDialogs extends SettingsPanelDialogMap<TPopovers> = SettingsPanelDialogMap<TPopovers>
> =
  | {
      refresh?: 'self' | 'root' | 'all'
      closePopover?: boolean
      openDialog?: never
      openPopover?: never
      close?: never
    }
  | {
      openDialog: SettingsPanelDialogTarget<TDialogs>
      closePopover?: boolean
      refresh?: never
      openPopover?: never
      close?: never
    }
  | {
      openPopover: SettingsPanelPopoverTarget<TPopovers>
      closePopover?: boolean
      refresh?: never
      openDialog?: never
      close?: never
    }
  | {
      close: 'root'
      refresh?: never
      openDialog?: never
      openPopover?: never
      closePopover?: never
    }

export type SettingsPanelDialogButtonEffect<
  TPopovers extends SettingsPanelPopoverMap = SettingsPanelPopoverMap
> =
  | {
      refresh?: 'self' | 'dialog' | 'root' | 'all'
      closePopover?: boolean
      openPopover?: never
      close?: never
    }
  | {
      openPopover: SettingsPanelPopoverTarget<TPopovers>
      closePopover?: boolean
      refresh?: never
      close?: never
    }
  | {
      close: 'dialog'
      closePopover?: boolean
      refresh?: never
      openPopover?: never
    }

export type SettingsPanelPopoverEffect = {
  refresh?: 'self' | 'popover' | 'dialog' | 'root' | 'all'
  closePopover?: boolean
}

export type SettingsPanelPopoverActionResult = SettingsPanelResult<
  SettingsPanelPopoverEffect,
  'self' | 'popover' | 'dialog' | 'root' | 'all'
>

export type SettingsPanelPopoverCommitResult = SettingsPanelPopoverActionResult

export type SettingsPanelRootButtonResult<
  TPopovers extends SettingsPanelPopoverMap = SettingsPanelPopoverMap,
  TDialogs extends SettingsPanelDialogMap<TPopovers> = SettingsPanelDialogMap<TPopovers>
> = SettingsPanelResult<SettingsPanelRootButtonEffect<TPopovers, TDialogs>, 'self' | 'root' | 'all'>

export type SettingsPanelDialogButtonResult<
  TPopovers extends SettingsPanelPopoverMap = SettingsPanelPopoverMap
> = SettingsPanelResult<
  SettingsPanelDialogButtonEffect<TPopovers>,
  'self' | 'dialog' | 'root' | 'all'
>

export type SettingsPanelPopoverButtonResult = SettingsPanelPopoverActionResult

export type SettingsPanelRootSubmitEffect =
  | {
      refresh?: 'self' | 'root' | 'all'
      closePopover?: boolean
      close?: never
    }
  | {
      close: 'root'
      closePopover?: boolean
      refresh?: never
    }

export type SettingsPanelRootSubmitResult = SettingsPanelResult<
  SettingsPanelRootSubmitEffect,
  'self' | 'root' | 'all'
>

export type SettingsPanelDialogSubmitEffect =
  | {
      refresh?: 'self' | 'dialog' | 'root' | 'all'
      closePopover?: boolean
      close?: never
    }
  | {
      close: 'dialog'
      closePopover?: boolean
      refresh?: never
    }

export type SettingsPanelDialogSubmitResult = SettingsPanelResult<
  SettingsPanelDialogSubmitEffect,
  'self' | 'dialog' | 'root' | 'all'
>

export interface SettingsPanelRootButtonHelpers<
  TPopovers extends SettingsPanelPopoverMap,
  TDialogs extends SettingsPanelDialogMap<TPopovers>
> {
  success(
    options?: SettingsPanelSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsPanelRootButtonResult<TPopovers, TDialogs>
  fail(
    error: ExtensionErrorShape,
    options?: SettingsPanelFailureOptions<'self' | 'root' | 'all'>
  ): SettingsPanelRootButtonResult<TPopovers, TDialogs>
  refresh(
    target?: 'self' | 'root' | 'all',
    options?: SettingsPanelSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsPanelRootButtonResult<TPopovers, TDialogs>
  close(
    target: 'root',
    options?: SettingsPanelCloseOptions
  ): SettingsPanelRootButtonResult<TPopovers, TDialogs>
  closePopover(
    options?: SettingsPanelSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsPanelRootButtonResult<TPopovers, TDialogs>
  openDialog<TDialogId extends SettingsPanelDialogId<TDialogs>>(
    dialogId: TDialogId,
    params?: SettingsPanelDialogParams<TDialogs[TDialogId]>,
    options?: SettingsPanelOpenOptions
  ): SettingsPanelRootButtonResult<TPopovers, TDialogs>
  openPopover<TPopoverId extends SettingsPanelPopoverId<TPopovers>>(
    popoverId: TPopoverId,
    params?: SettingsPanelPopoverParams<TPopovers[TPopoverId]>,
    options?: SettingsPanelOpenOptions
  ): SettingsPanelRootButtonResult<TPopovers, TDialogs>
}

export interface SettingsPanelRootCommitHelpers {
  success(
    options?: SettingsPanelSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsPanelRootCommitResult
  fail(
    error: ExtensionErrorShape,
    options?: SettingsPanelFailureOptions<'self' | 'root' | 'all'>
  ): SettingsPanelRootCommitResult
  refresh(
    target?: 'self' | 'root' | 'all',
    options?: SettingsPanelSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsPanelRootCommitResult
  closePopover(
    options?: SettingsPanelSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsPanelRootCommitResult
}

export interface SettingsPanelRootSubmitHelpers {
  success(
    options?: SettingsPanelSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsPanelRootSubmitResult
  fail(
    error: ExtensionErrorShape,
    options?: SettingsPanelFailureOptions<'self' | 'root' | 'all'>
  ): SettingsPanelRootSubmitResult
  refresh(
    target?: 'self' | 'root' | 'all',
    options?: SettingsPanelSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsPanelRootSubmitResult
  close(target: 'root', options?: SettingsPanelClosePopoverOptions): SettingsPanelRootSubmitResult
  closePopover(
    options?: SettingsPanelSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsPanelRootSubmitResult
}

export interface SettingsPanelDialogButtonHelpers<TPopovers extends SettingsPanelPopoverMap> {
  success(
    options?: SettingsPanelSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsPanelDialogButtonResult<TPopovers>
  fail(
    error: ExtensionErrorShape,
    options?: SettingsPanelFailureOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsPanelDialogButtonResult<TPopovers>
  refresh(
    target?: 'self' | 'dialog' | 'root' | 'all',
    options?: SettingsPanelSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsPanelDialogButtonResult<TPopovers>
  close(
    target: 'dialog',
    options?: SettingsPanelClosePopoverOptions
  ): SettingsPanelDialogButtonResult<TPopovers>
  closePopover(
    options?: SettingsPanelSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsPanelDialogButtonResult<TPopovers>
  openPopover<TPopoverId extends SettingsPanelPopoverId<TPopovers>>(
    popoverId: TPopoverId,
    params?: SettingsPanelPopoverParams<TPopovers[TPopoverId]>,
    options?: SettingsPanelOpenOptions
  ): SettingsPanelDialogButtonResult<TPopovers>
}

export interface SettingsPanelDialogCommitHelpers {
  success(
    options?: SettingsPanelSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsPanelDialogCommitResult
  fail(
    error: ExtensionErrorShape,
    options?: SettingsPanelFailureOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsPanelDialogCommitResult
  refresh(
    target?: 'self' | 'dialog' | 'root' | 'all',
    options?: SettingsPanelSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsPanelDialogCommitResult
  closePopover(
    options?: SettingsPanelSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsPanelDialogCommitResult
}

export interface SettingsPanelDialogSubmitHelpers {
  success(
    options?: SettingsPanelSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsPanelDialogSubmitResult
  fail(
    error: ExtensionErrorShape,
    options?: SettingsPanelFailureOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsPanelDialogSubmitResult
  refresh(
    target?: 'self' | 'dialog' | 'root' | 'all',
    options?: SettingsPanelSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsPanelDialogSubmitResult
  close(
    target: 'dialog',
    options?: SettingsPanelClosePopoverOptions
  ): SettingsPanelDialogSubmitResult
  closePopover(
    options?: SettingsPanelSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsPanelDialogSubmitResult
}

export interface SettingsPanelPopoverActionHelpers {
  success(
    options?: SettingsPanelSuccessOptions<'self' | 'popover' | 'dialog' | 'root' | 'all'>
  ): SettingsPanelPopoverActionResult
  fail(
    error: ExtensionErrorShape,
    options?: SettingsPanelFailureOptions<'self' | 'popover' | 'dialog' | 'root' | 'all'>
  ): SettingsPanelPopoverActionResult
  refresh(
    target?: 'self' | 'popover' | 'dialog' | 'root' | 'all',
    options?: SettingsPanelSuccessOptions<'self' | 'popover' | 'dialog' | 'root' | 'all'>
  ): SettingsPanelPopoverActionResult
  closePopover(
    options?: SettingsPanelSuccessOptions<'self' | 'popover' | 'dialog' | 'root' | 'all'>
  ): SettingsPanelPopoverActionResult
}
