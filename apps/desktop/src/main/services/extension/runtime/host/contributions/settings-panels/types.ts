import type {
  SerializableRecord,
  SettingsPanelDialogSize,
  SettingsPanelPopoverWidth,
  SettingsPanelCallbackResult,
  SettingsPanelContribution,
  SettingsPanelDraftSnapshot,
  SettingsPanelInvokeRequest,
  SettingsPanelParentRef,
  SettingsPanelRefreshReason
} from '@kisaki/extension-api'
import type { LoadedExtensionRuntime } from '../../extension-registry'
export type SettingsPanelSurface = 'root' | 'dialog' | 'popover'
export type SettingsPanelCallbackKind = 'commit' | 'button'

export interface SettingsPanelSession {
  runtimeHandle: string
  contributionId: string
  sessionId: string
  root?: SettingsPanelSurfaceSession
  activeDialog?: SettingsPanelSurfaceSession
  activeRootPopover?: SettingsPanelSurfaceSession
  activeDialogPopover?: SettingsPanelSurfaceSession
}

export interface SettingsPanelSurfaceSession {
  surface: SettingsPanelSurface
  dialogId?: string
  popoverId?: string
  parent?: SettingsPanelParentRef
  anchorNodeKey?: string
  params: SerializableRecord
  callbacks: Map<string, SettingsPanelCallbackRecord>
}

export interface SettingsPanelCallbackRecord {
  kind: SettingsPanelCallbackKind
  fieldId: string
  nodeId: string
  invoke(
    request: SettingsPanelInvokeRequest,
    signal: AbortSignal
  ): Promise<SettingsPanelCallbackResult>
}

export interface ResolveSettingsPanelRootOptions {
  runtime: LoadedRuntime
  contribution: SettingsPanelContribution<any, any>
  session: SettingsPanelSession
  draft: SettingsPanelDraftSnapshot
  reason?: SettingsPanelRefreshReason
  signal: AbortSignal
}

export interface ResolveSettingsPanelDialogOptions {
  runtime: LoadedRuntime
  contribution: SettingsPanelContribution<any, any>
  session: SettingsPanelSession
  dialogId: string
  params: SerializableRecord
  draft: SettingsPanelDraftSnapshot
  parentDraft: SettingsPanelDraftSnapshot
  reason?: SettingsPanelRefreshReason
  signal: AbortSignal
}

export interface ResolveSettingsPanelPopoverOptions {
  runtime: LoadedRuntime
  contribution: SettingsPanelContribution<any, any>
  session: SettingsPanelSession
  popoverId: string
  parent: SettingsPanelParentRef
  params: SerializableRecord
  draft: SettingsPanelDraftSnapshot
  parentDraft: SettingsPanelDraftSnapshot
  anchorNodeKey?: string
  reason?: SettingsPanelRefreshReason
  signal: AbortSignal
}

export type LoadedRuntime = LoadedExtensionRuntime

export interface NormalizeSettingsPanelContext {
  extensionId: string
  contribution: SettingsPanelContribution<any, any>
  session: SettingsPanelSession
  surface: SettingsPanelSurfaceSession
  anchorNodeKey?: string
  surfaceDefaults?: {
    title?: string
    size?: SettingsPanelDialogSize
    submitLabel?: string
    width?: SettingsPanelPopoverWidth
  }
}

export const EMPTY_DRAFT: SettingsPanelDraftSnapshot = Object.freeze({
  values: Object.freeze({}),
  dirtyNodeIds: Object.freeze([])
})
