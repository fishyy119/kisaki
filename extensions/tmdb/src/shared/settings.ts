/**
 * Webview RPC contract between the extension host entry and the settings
 * webview document. Both sides live in this project and import these types
 * directly.
 */

export const TMDB_SETTINGS_ENTRY = 'settings/index.html'

/**
 * How a stored key authenticates a request. TMDB accepts both the v3 API key
 * (a query parameter) and the v4 read access token (a bearer JWT); the two are
 * told apart by shape, so users paste either one without picking a mode.
 */
export type TmdbAuthMode = 'apiKey' | 'bearer'

/** Official endpoints; both sides offer them as the restore point of a mirror. */
export const TMDB_DEFAULT_API_BASE_URL = 'https://api.themoviedb.org/3'
export const TMDB_DEFAULT_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'

/** Where a user creates the key this extension needs. */
export const TMDB_API_SETTINGS_URL = 'https://www.themoviedb.org/settings/api'

/** Accepts an http(s) origin with an optional path. */
export function matchesHttpUrlFormat(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export interface TmdbSettingsFormState {
  apiBaseUrl: string
  imageBaseUrl: string
  includeAdult: boolean
  timeoutSeconds: number
  retryCount: number
}

export interface TmdbCredentialState {
  configured: boolean
  /** How the stored key authenticates, or `null` when none is stored. */
  mode: TmdbAuthMode | null
}

export interface TmdbSettingsOverview {
  form: TmdbSettingsFormState
  credential: TmdbCredentialState
}

/** Functions the extension host exposes to the settings webview. */
export interface TmdbSettingsHostFunctions {
  getOverview(): Promise<TmdbSettingsOverview>
  saveSettings(form: TmdbSettingsFormState): Promise<void>
  saveApiKey(key: string): Promise<TmdbCredentialState>
  clearApiKey(): Promise<TmdbCredentialState>
  /** Calls the cheapest authenticated endpoint; rejects with a safe message. */
  testConnection(): Promise<void>
  resetSettings(): Promise<void>
  openExternal(url: string): Promise<void>
}
