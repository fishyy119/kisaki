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
}

/**
 * The Kana API is open, so a token is an optional upgrade rather than a
 * prerequisite: it raises the caller's rate limit.
 */
export interface VndbCredentialState {
  configured: boolean
}

export interface VndbSettingsOverview {
  form: VndbSettingsFormState
  credential: VndbCredentialState
}

/** Functions the extension host exposes to the settings webview. */
export interface VndbSettingsHostFunctions {
  getOverview(): Promise<VndbSettingsOverview>
  saveSettings(form: VndbSettingsFormState): Promise<void>
  saveToken(token: string): Promise<VndbCredentialState>
  clearToken(): Promise<VndbCredentialState>
  /** Calls the cheapest endpoint; rejects with a safe message. */
  testConnection(): Promise<void>
  resetSettings(): Promise<void>
  openExternal(url: string): Promise<void>
}
