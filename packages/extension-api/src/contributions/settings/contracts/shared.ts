import type { SerializableRecord } from '../../../shared'

export type { MaybePromise } from '../../../shared'

export interface SettingsPanelRefreshReason {
  reason?: string
  params?: SerializableRecord
}

export type SettingsPanelRefreshTarget = 'self' | 'root' | 'dialog' | 'popover' | 'all'

export interface SettingsPanelSuccessOptions<
  TRefresh extends SettingsPanelRefreshTarget = SettingsPanelRefreshTarget
> {
  message?: string
  refresh?: TRefresh
  closePopover?: boolean
}

export interface SettingsPanelFailureOptions<
  TRefresh extends SettingsPanelRefreshTarget = SettingsPanelRefreshTarget
> {
  refresh?: TRefresh
  closePopover?: boolean
}

export interface SettingsPanelOpenOptions {
  message?: string
  closePopover?: boolean
}

export interface SettingsPanelCloseOptions {
  message?: string
}

export interface SettingsPanelClosePopoverOptions extends SettingsPanelCloseOptions {
  closePopover?: boolean
}

export type SettingsPanelDialogSize = 'sm' | 'md' | 'lg' | 'xl'
export type SettingsPanelPopoverWidth = 'sm' | 'md' | 'lg'
export type SettingsPanelNodeWidth = 'auto' | 'sm' | 'md' | 'lg' | 'full'
