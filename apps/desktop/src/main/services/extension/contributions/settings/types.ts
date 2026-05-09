import type {
  ExtensionRuntimeHandle,
  SettingsContributionRegistration
} from '@kisaki/extension-api'
import type { ExtensionSettingsParentRef } from '@shared/extension'
import type { RuntimeContributionOwner } from '../types'

export interface SettingsRegistration {
  owner: RuntimeContributionOwner
  contribution: SettingsContributionRegistration
}

export interface SettingsSurfaceLease {
  revision: number
}

export interface SettingsDialogLease extends SettingsSurfaceLease {
  dialogId: string
}

export interface SettingsPopoverLease extends SettingsSurfaceLease {
  popoverId: string
  parent: ExtensionSettingsParentRef
}

export interface MainSettingsSession {
  extensionId: string
  contributionId: string
  runtimeHandle: ExtensionRuntimeHandle
  sessionId: string
  root: SettingsSurfaceLease
  activeDialog?: SettingsDialogLease
  activeRootPopover?: SettingsPopoverLease
  activeDialogPopover?: SettingsPopoverLease
}
