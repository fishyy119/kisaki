/**
 * Webview RPC contract between the extension host entry and the settings
 * webview document. Both sides live in this project and import these types
 * directly.
 */

export const GBOOKS_SETTINGS_ENTRY = 'settings/index.html'

/** Kisaki OAuth relay route holding the Google client secret. */
export const GBOOKS_DEFAULT_OAUTH_RELAY_URL = 'https://oauth-relay.ximu.dev/kisaki/google-books'

/** Accepts an http(s) origin with an optional path. */
export function matchesHttpUrlFormat(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export interface GbooksSettingsFormState {
  oauthRelayUrl: string
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

export interface GbooksSettingsOverview {
  form: GbooksSettingsFormState
  account: GbooksAccountState
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
  resetSettings(): Promise<void>
}
