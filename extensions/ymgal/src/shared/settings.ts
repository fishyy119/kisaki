/**
 * Webview RPC contract between the extension host entry and the settings
 * webview document. Both sides live in this project and import these types
 * directly.
 */

export const YMGAL_SETTINGS_ENTRY = 'settings/index.html'

/** Official API root; offered as the restore point when a mirror is set. */
export const YMGAL_DEFAULT_API_BASE_URL = 'https://www.ymgal.games'

/** Where a user requests a dedicated client of their own. */
export const YMGAL_DEVELOPER_URL = 'https://www.ymgal.games/developer'

/** Accepts an http(s) origin with an optional path. */
export function matchesHttpUrlFormat(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export interface YmgalSettingsFormState {
  apiBaseUrl: string
  preferChineseNames: boolean
  timeoutSeconds: number
  retryCount: number
}

/**
 * Which OAuth client the extension authenticates with. YMGal publishes a
 * shared public client, so the extension always has one; `custom` means the
 * user stored their own.
 */
export interface YmgalCredentialState {
  configured: boolean
  /** Client id in use, shown so the user can tell the two apart. */
  clientId: string
}

export interface YmgalSettingsOverview {
  form: YmgalSettingsFormState
  credential: YmgalCredentialState
}

/** Functions the extension host exposes to the settings webview. */
export interface YmgalSettingsHostFunctions {
  getOverview(): Promise<YmgalSettingsOverview>
  saveSettings(form: YmgalSettingsFormState): Promise<void>
  saveCredential(clientId: string, clientSecret: string): Promise<YmgalCredentialState>
  /** Drops the stored client, falling back to the shared public one. */
  clearCredential(): Promise<YmgalCredentialState>
  /** Requests a token with the active client; rejects with a safe message. */
  testConnection(): Promise<void>
  resetSettings(): Promise<void>
  openExternal(url: string): Promise<void>
}
