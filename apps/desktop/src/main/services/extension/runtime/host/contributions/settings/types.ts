import type {
  SerializableRecord,
  SettingsCallbackResult,
  SettingsContribution,
  SettingsDraftSnapshot,
  SettingsInvokeRequest,
  SettingsParentRef,
  SettingsRefreshReason
} from '@kisaki/extension-api'
import type { LoadedExtensionRuntime } from '../../extension-registry'
export type SettingsSurface = 'root' | 'dialog' | 'popover'
export type SettingsCallbackKind = 'commit' | 'button'

export interface SettingsSession {
  runtimeHandle: string
  contributionId: string
  sessionId: string
  root?: SettingsSurfaceSession
  activeDialog?: SettingsSurfaceSession
  activeRootPopover?: SettingsSurfaceSession
  activeDialogPopover?: SettingsSurfaceSession
  ttlTimer: ReturnType<typeof setTimeout> | null
}

export interface SettingsSurfaceSession {
  surface: SettingsSurface
  dialogId?: string
  popoverId?: string
  parent?: SettingsParentRef
  anchorNodeKey?: string
  params: SerializableRecord
  callbacks: Map<string, SettingsCallbackRecord>
}

export interface SettingsCallbackRecord {
  kind: SettingsCallbackKind
  fieldId: string
  nodeId: string
  invoke(request: SettingsInvokeRequest, signal: AbortSignal): Promise<SettingsCallbackResult>
}

export interface ResolveRootOptions {
  runtime: LoadedRuntime
  contribution: SettingsContribution<any, any>
  session: SettingsSession
  draft: SettingsDraftSnapshot
  reason?: SettingsRefreshReason
  signal: AbortSignal
}

export interface ResolveDialogOptions {
  runtime: LoadedRuntime
  contribution: SettingsContribution<any, any>
  session: SettingsSession
  dialogId: string
  params: SerializableRecord
  draft: SettingsDraftSnapshot
  parentDraft: SettingsDraftSnapshot
  reason?: SettingsRefreshReason
  signal: AbortSignal
}

export interface ResolvePopoverOptions {
  runtime: LoadedRuntime
  contribution: SettingsContribution<any, any>
  session: SettingsSession
  popoverId: string
  parent: SettingsParentRef
  params: SerializableRecord
  draft: SettingsDraftSnapshot
  parentDraft: SettingsDraftSnapshot
  anchorNodeKey?: string
  reason?: SettingsRefreshReason
  signal: AbortSignal
}

export type LoadedRuntime = LoadedExtensionRuntime

export interface NormalizeSettingsContext {
  extensionId: string
  contribution: SettingsContribution<any, any>
  session: SettingsSession
  surface: SettingsSurfaceSession
  anchorNodeKey?: string
}

export const SESSION_TTL_MS = 10 * 60 * 1000
export const EMPTY_DRAFT: SettingsDraftSnapshot = Object.freeze({
  values: Object.freeze({}),
  dirtyNodeIds: Object.freeze([])
})
