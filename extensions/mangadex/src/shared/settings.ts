/**
 * Webview RPC contract between the extension host entry and the settings
 * webview document. Both sides live in this project and import these types
 * directly.
 */

export const MANGADEX_SETTINGS_ENTRY = 'settings/index.html'

export interface MangadexSettingsFormState {
  /** Prefer the romanized title over the English one outside native locales. */
  preferRomanizedTitles: boolean
  timeoutSeconds: number
  retryCount: number
  /** Push local status and score changes to MangaDex automatically. */
  syncEnabled: boolean
  /** Include the local score when pushing. */
  syncPushScore: boolean
}

/** Personal-client credential set; MangaDex's official channel for personal tools. */
export interface MangadexCredentialsInput {
  clientId: string
  clientSecret: string
  username: string
  password: string
}

export interface MangadexAccountState {
  configured: boolean
}

export interface MangadexAccountVerification {
  userId: string
  userName: string
}

export interface MangadexSettingsOverview {
  form: MangadexSettingsFormState
  account: MangadexAccountState
}

export interface MangadexProfileOption {
  id: string
  name: string
}

export interface MangadexImportRequest {
  updateExisting: boolean
  createMissing: boolean
  profileId?: string
  /** Also read the user's ratings and write them as scores. */
  importScores: boolean
}

/** Task-run projection the settings webview polls while an operation runs. */
export interface MangadexTaskStateView {
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
export interface MangadexSettingsHostFunctions {
  getOverview(): Promise<MangadexSettingsOverview>
  saveSettings(form: MangadexSettingsFormState): Promise<void>
  /** Stores the personal-client credentials and validates them with a sign-in. */
  saveCredentials(input: MangadexCredentialsInput): Promise<MangadexAccountVerification>
  clearCredentials(): Promise<MangadexAccountState>
  /** Validates the stored credentials against the own-user endpoint. */
  verifyAccount(): Promise<MangadexAccountVerification>
  listComicProfiles(): Promise<MangadexProfileOption[]>
  startImport(request: MangadexImportRequest): Promise<{ runId: string }>
  startPushAll(): Promise<{ runId: string }>
  getTaskState(runId: string): Promise<MangadexTaskStateView | null>
  cancelTask(runId: string): Promise<boolean>
  resetSettings(): Promise<void>
  openExternal(url: string): Promise<void>
}
