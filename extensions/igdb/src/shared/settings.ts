/**
 * Webview RPC contract between the extension host entry and the settings
 * webview document. Both sides live in this project and import these types
 * directly.
 */

export const IGDB_SETTINGS_ENTRY = 'settings/index.html'

/** Official endpoints; offered as the restore point when a mirror is set. */
export const IGDB_DEFAULT_API_BASE_URL = 'https://api.igdb.com/v4'
export const IGDB_DEFAULT_OAUTH_URL = 'https://id.twitch.tv/oauth2/token'

/** Where a user registers the Twitch application IGDB authenticates against. */
export const TWITCH_CONSOLE_URL = 'https://dev.twitch.tv/console/apps'

/** Accepts an http(s) origin with an optional path. */
export function matchesHttpUrlFormat(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export interface IgdbSettingsFormState {
  apiBaseUrl: string
  oauthUrl: string
  timeoutSeconds: number
  retryCount: number
}

/**
 * IGDB has no anonymous access: without a Twitch client the providers cannot
 * answer at all, so the credential state is a prerequisite rather than an
 * upgrade.
 */
export interface IgdbCredentialState {
  configured: boolean
  /** Client id in use, shown so the user can confirm which application. */
  clientId: string | null
}

export interface IgdbSettingsOverview {
  form: IgdbSettingsFormState
  credential: IgdbCredentialState
}

/** Functions the extension host exposes to the settings webview. */
export interface IgdbSettingsHostFunctions {
  getOverview(): Promise<IgdbSettingsOverview>
  saveSettings(form: IgdbSettingsFormState): Promise<void>
  saveCredential(clientId: string, clientSecret: string): Promise<IgdbCredentialState>
  clearCredential(): Promise<IgdbCredentialState>
  /** Requests a token with the stored client; rejects with a safe message. */
  testConnection(): Promise<void>
  resetSettings(): Promise<void>
  openExternal(url: string): Promise<void>
}
