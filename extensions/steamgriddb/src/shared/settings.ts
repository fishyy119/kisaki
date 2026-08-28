/**
 * Webview RPC contract between the extension host entry and the settings
 * webview document. Both sides live in this project and import these types
 * directly.
 */

export const SGDB_SETTINGS_ENTRY = 'settings/index.html'

export const SGDB_API_KEY_PAGE_URL = 'https://www.steamgriddb.com/profile/preferences/api'

export interface SgdbSettingsFormState {
  /** Include artwork the community marked as NSFW. */
  includeNsfw: boolean
  timeoutSeconds: number
  retryCount: number
}

export interface SgdbAccountState {
  keyConfigured: boolean
}

export interface SgdbSettingsOverview {
  form: SgdbSettingsFormState
  account: SgdbAccountState
}

/** Functions the extension host exposes to the settings webview. */
export interface SgdbSettingsHostFunctions {
  getOverview(): Promise<SgdbSettingsOverview>
  saveSettings(form: SgdbSettingsFormState): Promise<void>
  /** Stores the API key and validates it with a probe search. */
  saveApiKey(key: string): Promise<SgdbAccountState>
  clearApiKey(): Promise<SgdbAccountState>
  resetSettings(): Promise<void>
  openExternal(url: string): Promise<void>
}
