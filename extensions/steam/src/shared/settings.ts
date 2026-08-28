/**
 * Webview RPC contract between the extension host entry and the settings
 * webview document. Both sides live in this project and import these types
 * directly.
 */

export const STEAM_SETTINGS_ENTRY = 'settings/index.html'

export const STEAM_API_KEY_PAGE_URL = 'https://steamcommunity.com/dev/apikey'

/** SteamID64: seventeen digits starting with the universe prefix. */
export function matchesSteamId64Format(value: string): boolean {
  return /^7656\d{13}$/.test(value.trim())
}

export interface SteamSettingsFormState {
  /** SteamID64 of the account whose library the import reads. */
  steamId: string
  timeoutSeconds: number
  retryCount: number
}

export interface SteamAccountState {
  /** Whether a Web API key is stored. */
  keyConfigured: boolean
}

export interface SteamAccountVerification {
  /** Owned games visible through the key and SteamID. */
  gameCount: number
}

export interface SteamSettingsOverview {
  form: SteamSettingsFormState
  account: SteamAccountState
}

export interface SteamProfileOption {
  id: string
  name: string
}

export interface SteamImportRequest {
  profileId: string
}

/** Task-run projection the settings webview polls while an operation runs. */
export interface SteamTaskStateView {
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
export interface SteamSettingsHostFunctions {
  getOverview(): Promise<SteamSettingsOverview>
  saveSettings(form: SteamSettingsFormState): Promise<void>
  /** Stores the Web API key. */
  saveApiKey(key: string): Promise<SteamAccountState>
  clearApiKey(): Promise<SteamAccountState>
  /** Validates key and SteamID by counting the owned games. */
  verifyAccount(): Promise<SteamAccountVerification>
  listGameProfiles(): Promise<SteamProfileOption[]>
  startImport(request: SteamImportRequest): Promise<{ runId: string }>
  getTaskState(runId: string): Promise<SteamTaskStateView | null>
  cancelTask(runId: string): Promise<boolean>
  resetSettings(): Promise<void>
  openExternal(url: string): Promise<void>
}
