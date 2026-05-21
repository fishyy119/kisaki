import type { ExtensionRuntimeHandle, SettingsPanelRegistrationInfo } from '@kisaki/extension-api'
import type { ExtensionSettingsPanelParentRef } from '@shared/extension'
import type { RuntimeContributionOwner } from '../types'

export interface SettingsRegistration {
  owner: RuntimeContributionOwner
  contribution: SettingsPanelRegistrationInfo
}

export interface SettingsSurfaceLease {
  revision: number
}

export interface SettingsDialogLease extends SettingsSurfaceLease {
  dialogId: string
}

export interface SettingsPopoverLease extends SettingsSurfaceLease {
  popoverId: string
  parent: ExtensionSettingsPanelParentRef
}

export interface MainSettingsSession {
  extensionId: string
  contributionId: string
  runtimeHandle: ExtensionRuntimeHandle
  sessionId: string
  abortController: AbortController
  root: SettingsSurfaceLease
  activeDialog?: SettingsDialogLease
  activeRootPopover?: SettingsPopoverLease
  activeDialogPopover?: SettingsPopoverLease
}
