/**
 * Webview RPC contract between the extension host entry and the settings
 * webview document. Both sides live in this project and import these types
 * directly.
 */

export const VNDB_SETTINGS_ENTRY = 'settings/index.html'

/** Official Kana API root; offered as the restore point when a mirror is set. */
export const VNDB_DEFAULT_API_BASE_URL = 'https://api.vndb.org/kana'

/** Where a user creates the optional token. */
export const VNDB_TOKEN_SETTINGS_URL = 'https://vndb.org/u/tokens'

/** Accepts an http(s) origin with an optional path. */
export function matchesHttpUrlFormat(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export interface VndbSettingsFormState {
  apiBaseUrl: string
  /** Prefer the romanized title over the original script for the display name. */
  preferRomanizedTitles: boolean
  timeoutSeconds: number
  retryCount: number
  /** Push local status and score changes to the VNDB list automatically. */
  syncEnabled: boolean
  /** Include the local score as a VNDB vote when pushing. */
  syncPushScore: boolean
}

/**
 * The Kana API is open, so a token is an optional upgrade for scraping; the
 * list integration is what actually requires one.
 */
export interface VndbCredentialState {
  configured: boolean
}

/** What `GET /authinfo` reports about the stored token. */
export interface VndbAccountVerification {
  userId: string
  username: string
  listRead: boolean
  listWrite: boolean
}

export type VndbAutomationKind = 'auth-check' | 'push-full-daily' | 'import-refresh-weekly'

export type VndbAutomationStatus = 'missing' | 'enabled' | 'disabled'

export interface VndbAutomationState {
  kind: VndbAutomationKind
  status: VndbAutomationStatus
}

export interface VndbSettingsOverview {
  form: VndbSettingsFormState
  credential: VndbCredentialState
  automations: readonly VndbAutomationState[]
  /** Operations of the extension's currently active task runs. */
  runningOperations: readonly string[]
}

export interface VndbGameProfileOption {
  id: string
  name: string
}

export interface VndbImportRequest {
  /** Write list status and vote onto entries the library already has. */
  updateExisting: boolean
  /** Create entries for list rows the library does not know. */
  createMissing: boolean
  /** Game scraper profile used to create missing entries. */
  profileId?: string
}

/** Task-run projection the settings webview polls while an operation runs. */
export interface VndbTaskStateView {
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
export interface VndbSettingsHostFunctions {
  getOverview(): Promise<VndbSettingsOverview>
  saveSettings(form: VndbSettingsFormState): Promise<void>
  saveToken(token: string): Promise<VndbCredentialState>
  clearToken(): Promise<VndbCredentialState>
  /** Calls the cheapest endpoint; rejects with a safe message. */
  testConnection(): Promise<void>
  /** Validates the token against `/authinfo` and reports its permissions. */
  verifyAccount(): Promise<VndbAccountVerification>
  listGameProfiles(): Promise<VndbGameProfileOption[]>
  startImport(request: VndbImportRequest): Promise<{ runId: string }>
  startPushAll(): Promise<{ runId: string }>
  getTaskState(runId: string): Promise<VndbTaskStateView | null>
  cancelTask(runId: string): Promise<boolean>
  /** Creates one recommended app-owned automation for a VNDB command. */
  createAutomation(kind: VndbAutomationKind): Promise<void>
  resetSettings(): Promise<void>
  openExternal(url: string): Promise<void>
}
