import type { ExtensionErrorShape } from '../../../shared'
import type {
  SettingsDialogId,
  SettingsDialogMap,
  SettingsDialogParams,
  SettingsPopoverId,
  SettingsPopoverMap,
  SettingsPopoverParams
} from './definitions'
import type {
  SettingsCloseOptions,
  SettingsClosePopoverOptions,
  SettingsFailureOptions,
  SettingsOpenOptions,
  SettingsRefreshTarget,
  SettingsSuccessOptions
} from './shared'

export interface SettingsDialogTarget<
  TDialogs,
  TDialogId extends SettingsDialogId<TDialogs> = SettingsDialogId<TDialogs>
> {
  dialogId: TDialogId
  params?: SettingsDialogParams<TDialogs[TDialogId]>
}

export interface SettingsPopoverTarget<
  TPopovers,
  TPopoverId extends SettingsPopoverId<TPopovers> = SettingsPopoverId<TPopovers>
> {
  popoverId: TPopoverId
  params?: SettingsPopoverParams<TPopovers[TPopoverId]>
}

export type SettingsResult<
  TEffect extends object = Record<never, never>,
  TFailureRefresh extends SettingsRefreshTarget = SettingsRefreshTarget
> =
  | ({ success: true; message?: string } & TEffect)
  | {
      success: false
      error: ExtensionErrorShape
      refresh?: TFailureRefresh
      closePopover?: boolean
    }

export type SettingsRootCommitResult = SettingsResult<
  {
    refresh?: 'self' | 'root' | 'all'
    closePopover?: boolean
  },
  'self' | 'root' | 'all'
>

export type SettingsDialogCommitResult = SettingsResult<
  {
    refresh?: 'self' | 'dialog' | 'root' | 'all'
    closePopover?: boolean
  },
  'self' | 'dialog' | 'root' | 'all'
>

export type SettingsRootButtonEffect<
  TPopovers extends SettingsPopoverMap = SettingsPopoverMap,
  TDialogs extends SettingsDialogMap<TPopovers> = SettingsDialogMap<TPopovers>
> =
  | {
      refresh?: 'self' | 'root' | 'all'
      closePopover?: boolean
      openDialog?: never
      openPopover?: never
      close?: never
    }
  | {
      openDialog: SettingsDialogTarget<TDialogs>
      closePopover?: boolean
      refresh?: never
      openPopover?: never
      close?: never
    }
  | {
      openPopover: SettingsPopoverTarget<TPopovers>
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

export type SettingsDialogButtonEffect<TPopovers extends SettingsPopoverMap = SettingsPopoverMap> =
  | {
      refresh?: 'self' | 'dialog' | 'root' | 'all'
      closePopover?: boolean
      openPopover?: never
      close?: never
    }
  | {
      openPopover: SettingsPopoverTarget<TPopovers>
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

export type SettingsPopoverEffect = {
  refresh?: 'self' | 'popover' | 'dialog' | 'root' | 'all'
  closePopover?: boolean
}

export type SettingsPopoverActionResult = SettingsResult<
  SettingsPopoverEffect,
  'self' | 'popover' | 'dialog' | 'root' | 'all'
>

export type SettingsPopoverCommitResult = SettingsPopoverActionResult

export type SettingsRootButtonResult<
  TPopovers extends SettingsPopoverMap = SettingsPopoverMap,
  TDialogs extends SettingsDialogMap<TPopovers> = SettingsDialogMap<TPopovers>
> = SettingsResult<SettingsRootButtonEffect<TPopovers, TDialogs>, 'self' | 'root' | 'all'>

export type SettingsDialogButtonResult<TPopovers extends SettingsPopoverMap = SettingsPopoverMap> =
  SettingsResult<SettingsDialogButtonEffect<TPopovers>, 'self' | 'dialog' | 'root' | 'all'>

export type SettingsPopoverButtonResult = SettingsPopoverActionResult

export type SettingsRootSubmitEffect =
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

export type SettingsRootSubmitResult = SettingsResult<
  SettingsRootSubmitEffect,
  'self' | 'root' | 'all'
>

export type SettingsDialogSubmitEffect =
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

export type SettingsDialogSubmitResult = SettingsResult<
  SettingsDialogSubmitEffect,
  'self' | 'dialog' | 'root' | 'all'
>

export interface SettingsRootButtonHelpers<
  TPopovers extends SettingsPopoverMap,
  TDialogs extends SettingsDialogMap<TPopovers>
> {
  success(
    options?: SettingsSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsRootButtonResult<TPopovers, TDialogs>
  fail(
    error: ExtensionErrorShape,
    options?: SettingsFailureOptions<'self' | 'root' | 'all'>
  ): SettingsRootButtonResult<TPopovers, TDialogs>
  refresh(
    target?: 'self' | 'root' | 'all',
    options?: SettingsSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsRootButtonResult<TPopovers, TDialogs>
  close(
    target: 'root',
    options?: SettingsCloseOptions
  ): SettingsRootButtonResult<TPopovers, TDialogs>
  closePopover(
    options?: SettingsSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsRootButtonResult<TPopovers, TDialogs>
  openDialog<TDialogId extends SettingsDialogId<TDialogs>>(
    dialogId: TDialogId,
    params?: SettingsDialogParams<TDialogs[TDialogId]>,
    options?: SettingsOpenOptions
  ): SettingsRootButtonResult<TPopovers, TDialogs>
  openPopover<TPopoverId extends SettingsPopoverId<TPopovers>>(
    popoverId: TPopoverId,
    params?: SettingsPopoverParams<TPopovers[TPopoverId]>,
    options?: SettingsOpenOptions
  ): SettingsRootButtonResult<TPopovers, TDialogs>
}

export interface SettingsRootCommitHelpers {
  success(options?: SettingsSuccessOptions<'self' | 'root' | 'all'>): SettingsRootCommitResult
  fail(
    error: ExtensionErrorShape,
    options?: SettingsFailureOptions<'self' | 'root' | 'all'>
  ): SettingsRootCommitResult
  refresh(
    target?: 'self' | 'root' | 'all',
    options?: SettingsSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsRootCommitResult
  closePopover(options?: SettingsSuccessOptions<'self' | 'root' | 'all'>): SettingsRootCommitResult
}

export interface SettingsRootSubmitHelpers {
  success(options?: SettingsSuccessOptions<'self' | 'root' | 'all'>): SettingsRootSubmitResult
  fail(
    error: ExtensionErrorShape,
    options?: SettingsFailureOptions<'self' | 'root' | 'all'>
  ): SettingsRootSubmitResult
  refresh(
    target?: 'self' | 'root' | 'all',
    options?: SettingsSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsRootSubmitResult
  close(target: 'root', options?: SettingsClosePopoverOptions): SettingsRootSubmitResult
  closePopover(options?: SettingsSuccessOptions<'self' | 'root' | 'all'>): SettingsRootSubmitResult
}

export interface SettingsDialogButtonHelpers<TPopovers extends SettingsPopoverMap> {
  success(
    options?: SettingsSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogButtonResult<TPopovers>
  fail(
    error: ExtensionErrorShape,
    options?: SettingsFailureOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogButtonResult<TPopovers>
  refresh(
    target?: 'self' | 'dialog' | 'root' | 'all',
    options?: SettingsSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogButtonResult<TPopovers>
  close(
    target: 'dialog',
    options?: SettingsClosePopoverOptions
  ): SettingsDialogButtonResult<TPopovers>
  closePopover(
    options?: SettingsSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogButtonResult<TPopovers>
  openPopover<TPopoverId extends SettingsPopoverId<TPopovers>>(
    popoverId: TPopoverId,
    params?: SettingsPopoverParams<TPopovers[TPopoverId]>,
    options?: SettingsOpenOptions
  ): SettingsDialogButtonResult<TPopovers>
}

export interface SettingsDialogCommitHelpers {
  success(
    options?: SettingsSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogCommitResult
  fail(
    error: ExtensionErrorShape,
    options?: SettingsFailureOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogCommitResult
  refresh(
    target?: 'self' | 'dialog' | 'root' | 'all',
    options?: SettingsSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogCommitResult
  closePopover(
    options?: SettingsSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogCommitResult
}

export interface SettingsDialogSubmitHelpers {
  success(
    options?: SettingsSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogSubmitResult
  fail(
    error: ExtensionErrorShape,
    options?: SettingsFailureOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogSubmitResult
  refresh(
    target?: 'self' | 'dialog' | 'root' | 'all',
    options?: SettingsSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogSubmitResult
  close(target: 'dialog', options?: SettingsClosePopoverOptions): SettingsDialogSubmitResult
  closePopover(
    options?: SettingsSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogSubmitResult
}

export interface SettingsPopoverActionHelpers {
  success(
    options?: SettingsSuccessOptions<'self' | 'popover' | 'dialog' | 'root' | 'all'>
  ): SettingsPopoverActionResult
  fail(
    error: ExtensionErrorShape,
    options?: SettingsFailureOptions<'self' | 'popover' | 'dialog' | 'root' | 'all'>
  ): SettingsPopoverActionResult
  refresh(
    target?: 'self' | 'popover' | 'dialog' | 'root' | 'all',
    options?: SettingsSuccessOptions<'self' | 'popover' | 'dialog' | 'root' | 'all'>
  ): SettingsPopoverActionResult
  closePopover(
    options?: SettingsSuccessOptions<'self' | 'popover' | 'dialog' | 'root' | 'all'>
  ): SettingsPopoverActionResult
}
