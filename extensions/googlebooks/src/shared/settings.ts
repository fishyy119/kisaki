/**
 * Webview RPC contract between the extension host entry and the settings
 * webview document. Both sides live in this project and import these types
 * directly.
 */

export const GBOOKS_SETTINGS_ENTRY = 'settings/index.html'

export interface GbooksSettingsFormState {
  timeoutSeconds: number
  retryCount: number
}

export interface GbooksAccountState {
  configured: boolean
  /** Epoch ms of access-token expiry; refresh happens through the relay. */
  expiresAt?: number
  /** Whether an optional API key for higher search quota is stored. */
  apiKeyConfigured: boolean
  /** Set while a browser sign-in is waiting to be completed. */
  loginPending: boolean
}

export type GbooksAutomationKind = 'import-refresh-weekly'

export type GbooksAutomationStatus = 'missing' | 'enabled' | 'disabled'

export interface GbooksAutomationState {
  kind: GbooksAutomationKind
  status: GbooksAutomationStatus
}

export interface GbooksSettingsOverview {
  form: GbooksSettingsFormState
  account: GbooksAccountState
  automations: readonly GbooksAutomationState[]
  /** Operations of the extension's currently active task runs. */
  runningOperations: readonly string[]
}

export interface GbooksProfileOption {
  id: string
  name: string
}

/** Profiles selectable for created entries, per routed media type. */
export interface GbooksProfileOptions {
  novel: GbooksProfileOption[]
  comic: GbooksProfileOption[]
}

export interface GbooksImportRequest {
  /** Import the purchased and uploaded "My Google eBooks" library. */
  includeEbooks: boolean
  /** Import the predefined reading shelves as entry statuses. */
  includeReadingShelves: boolean
  updateExisting: boolean
  createMissing: boolean
  /** Collapse volumes of one series into a single entry. */
  mergeSeries: boolean
  novelProfileId?: string
  comicProfileId?: string
}

/** Task-run projection the settings webview polls while an operation runs. */
export interface GbooksTaskStateView {
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
export interface GbooksSettingsHostFunctions {
  getOverview(): Promise<GbooksSettingsOverview>
  saveSettings(form: GbooksSettingsFormState): Promise<void>
  /** Opens the browser sign-in through the relay. */
  startLogin(): Promise<GbooksAccountState>
  /** Completes a pending sign-in when the deeplink hop was missed. */
  completePendingLogin(): Promise<GbooksAccountState>
  cancelPendingLogin(): Promise<GbooksAccountState>
  logout(): Promise<GbooksAccountState>
  /** Stores the optional search-quota API key. */
  saveApiKey(key: string): Promise<GbooksAccountState>
  clearApiKey(): Promise<GbooksAccountState>
  listProfileOptions(): Promise<GbooksProfileOptions>
  startImport(request: GbooksImportRequest): Promise<{ runId: string }>
  getTaskState(runId: string): Promise<GbooksTaskStateView | null>
  cancelTask(runId: string): Promise<boolean>
  /** Creates one recommended app-owned automation for a Google Books command. */
  createAutomation(kind: GbooksAutomationKind): Promise<void>
  resetSettings(): Promise<void>
}

/**
 * Functions the settings webview exposes to the extension host. The OAuth
 * sign-in settles in the host through the deeplink, so account refreshes are
 * pushed straight into the open document.
 */
export interface GbooksSettingsUiFunctions {
  refreshRequested(reason: string): void
}
