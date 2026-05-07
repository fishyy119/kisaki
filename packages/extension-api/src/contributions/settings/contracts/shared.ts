import type { SerializableRecord } from '../../../shared'

export type { MaybePromise } from '../../../shared'

export interface SettingsRefreshReason {
  reason?: string
  params?: SerializableRecord
}

export type SettingsRefreshTarget = 'self' | 'root' | 'dialog' | 'popover' | 'all'

export interface SettingsSuccessOptions<
  TRefresh extends SettingsRefreshTarget = SettingsRefreshTarget
> {
  message?: string
  refresh?: TRefresh
  closePopover?: boolean
}

export interface SettingsFailureOptions<
  TRefresh extends SettingsRefreshTarget = SettingsRefreshTarget
> {
  refresh?: TRefresh
  closePopover?: boolean
}

export interface SettingsOpenOptions {
  message?: string
  closePopover?: boolean
}

export interface SettingsCloseOptions {
  message?: string
}

export interface SettingsClosePopoverOptions extends SettingsCloseOptions {
  closePopover?: boolean
}

export type SettingsDialogSize = 'sm' | 'md' | 'lg' | 'xl'
export type SettingsPopoverWidth = 'sm' | 'md' | 'lg'
export type SettingsNodeWidth = 'auto' | 'sm' | 'md' | 'lg' | 'full'
