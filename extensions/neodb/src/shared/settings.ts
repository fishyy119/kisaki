/**
 * Webview RPC contract between the extension host entry and the settings
 * webview document. Both sides live in this project and import these types
 * directly.
 */

export const NEODB_SETTINGS_ENTRY = 'settings/index.html'

/** Flagship instance; any NeoDB deployment works. */
export const NEODB_DEFAULT_INSTANCE_URL = 'https://neodb.social'

/** Accepts an http(s) origin with an optional path. */
export function matchesHttpUrlFormat(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export type NeodbSyncVisibility = 'public' | 'followers' | 'self'

export interface NeodbSettingsFormState {
  /** Root of the NeoDB instance the account lives on. */
  instanceUrl: string
  timeoutSeconds: number
  retryCount: number
  /** Push local status and score changes to the shelf automatically. */
  syncEnabled: boolean
  /** Include the local score when pushing. */
  syncPushScore: boolean
  /** Fediverse visibility of pushed marks. */
  syncVisibility: NeodbSyncVisibility
}

export interface NeodbAccountState {
  configured: boolean
  /** Instance the stored sign-in belongs to. */
  instanceUrl?: string
  /** Set while a browser sign-in is waiting to be completed. */
  loginPending: boolean
  /** The pending sign-in expects a manually pasted code. */
  loginManual: boolean
}

export interface NeodbAccountVerification {
  userName: string
  displayName: string
}

export type NeodbAutomationKind = 'auth-check' | 'push-full-daily' | 'import-refresh-weekly'

export type NeodbAutomationStatus = 'missing' | 'enabled' | 'disabled'

export interface NeodbAutomationState {
  kind: NeodbAutomationKind
  status: NeodbAutomationStatus
}

export interface NeodbSettingsOverview {
  form: NeodbSettingsFormState
  account: NeodbAccountState
  automations: readonly NeodbAutomationState[]
  /** Operations of the extension's currently active task runs. */
  runningOperations: readonly string[]
}

export interface NeodbProfileOption {
  id: string
  name: string
}

export interface NeodbImportRequest {
  updateExisting: boolean
  createMissing: boolean
  profileId?: string
}

/** Task-run projection the settings webview polls while an operation runs. */
export interface NeodbTaskStateView {
  runId: string
  status:
    | 'queued'
    | 'running'
    | 'pausing'
    | 'paused'
    | 'cancelling'
    | 'completed'
    | 'failed'
    | 'cancelled'
  current?: number
  total?: number
  counters?: Record<string, number>
  summary?: string
  error?: string
}

/** Functions the extension host exposes to the settings webview. */
export interface NeodbSettingsHostFunctions {
  getOverview(): Promise<NeodbSettingsOverview>
  saveSettings(form: NeodbSettingsFormState): Promise<void>
  /** Registers the app on the instance and opens the browser sign-in. */
  startLogin(): Promise<NeodbAccountState>
  /** Same, but with the out-of-band flow for instances that cannot bounce back. */
  startManualLogin(): Promise<NeodbAccountState>
  /** Completes a manual (out-of-band) sign-in with the pasted code. */
  completeManualLogin(code: string): Promise<NeodbAccountState>
  cancelPendingLogin(): Promise<NeodbAccountState>
  logout(): Promise<NeodbAccountState>
  /** Validates the stored token against the own-user endpoint. */
  verifyAccount(): Promise<NeodbAccountVerification>
  listNovelProfiles(): Promise<NeodbProfileOption[]>
  startImport(request: NeodbImportRequest): Promise<{ runId: string }>
  startPushAll(): Promise<{ runId: string }>
  getTaskState(runId: string): Promise<NeodbTaskStateView | null>
  cancelTask(runId: string): Promise<boolean>
  /** Creates one recommended app-owned automation for a NeoDB command. */
  createAutomation(kind: NeodbAutomationKind): Promise<void>
  resetSettings(): Promise<void>
}
