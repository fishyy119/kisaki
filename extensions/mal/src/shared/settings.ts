/**
 * Webview RPC contract between the extension host entry and the settings
 * webview document. Both sides live in this project and import these types
 * directly.
 */

export const MAL_SETTINGS_ENTRY = 'settings/index.html'

/** Official MAL API v2 root. */
export const MAL_DEFAULT_API_URL = 'https://api.myanimelist.net/v2'

/** Jikan-compatible mirror serving characters, staff, and episodes. */
export const MAL_DEFAULT_MIRROR_URL = 'https://api.tenrai.org/v1'

/** Accepts an http(s) origin with an optional path. */
export function matchesHttpUrlFormat(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export interface MalSettingsFormState {
  apiUrl: string
  mirrorEnabled: boolean
  mirrorUrl: string
  /** Prefer the romaji title over the English one outside Japanese content locales. */
  preferRomajiTitles: boolean
  timeoutSeconds: number
  retryCount: number
  /** Push local status and score changes to the MAL lists automatically. */
  syncEnabled: boolean
  /** Include the local score when pushing. */
  syncPushScore: boolean
}

export interface MalAccountState {
  configured: boolean
  /** Epoch ms of access-token expiry; refresh happens automatically. */
  expiresAt?: number
  /** Set while a browser sign-in is waiting to be completed. */
  loginPending: boolean
}

export interface MalAccountVerification {
  userId: number
  userName: string
}

export type MalAutomationKind = 'auth-check' | 'push-full-daily' | 'import-refresh-weekly'

export type MalAutomationStatus = 'missing' | 'enabled' | 'disabled'

export interface MalAutomationState {
  kind: MalAutomationKind
  status: MalAutomationStatus
}

export interface MalSettingsOverview {
  form: MalSettingsFormState
  account: MalAccountState
  automations: readonly MalAutomationState[]
  /** Operations of the extension's currently active task runs. */
  runningOperations: readonly string[]
}

export interface MalProfileOption {
  id: string
  name: string
}

/** Profiles selectable for created entries, grouped per local media type. */
export interface MalProfileOptions {
  anime: MalProfileOption[]
  comic: MalProfileOption[]
  novel: MalProfileOption[]
}

export interface MalImportRequest {
  /** Which MAL lists to read. */
  lists: ('anime' | 'manga')[]
  updateExisting: boolean
  createMissing: boolean
  animeProfileId?: string
  comicProfileId?: string
  novelProfileId?: string
}

/** Task-run projection the settings webview polls while an operation runs. */
export interface MalTaskStateView {
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
export interface MalSettingsHostFunctions {
  getOverview(): Promise<MalSettingsOverview>
  saveSettings(form: MalSettingsFormState): Promise<void>
  /** Opens the browser sign-in (direct PKCE against MAL). */
  startLogin(): Promise<MalAccountState>
  cancelPendingLogin(): Promise<MalAccountState>
  logout(): Promise<MalAccountState>
  /** Validates the stored token against the own-user endpoint. */
  verifyAccount(): Promise<MalAccountVerification>
  listProfileOptions(): Promise<MalProfileOptions>
  startImport(request: MalImportRequest): Promise<{ runId: string }>
  startPushAll(): Promise<{ runId: string }>
  getTaskState(runId: string): Promise<MalTaskStateView | null>
  cancelTask(runId: string): Promise<boolean>
  /** Creates one recommended app-owned automation for a MyAnimeList command. */
  createAutomation(kind: MalAutomationKind): Promise<void>
  resetSettings(): Promise<void>
  openExternal(url: string): Promise<void>
}

/**
 * Functions the settings webview exposes to the extension host. The OAuth
 * sign-in settles in the host through the deeplink, so account refreshes are
 * pushed straight into the open document.
 */
export interface MalSettingsUiFunctions {
  refreshRequested(reason: string): void
}
