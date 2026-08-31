/**
 * Webview RPC contract between the extension host entry and the settings
 * webview document. Both sides live in this project and import these types
 * directly.
 */

export const ANILIST_SETTINGS_ENTRY = 'settings/index.html'

/** Official GraphQL endpoint; offered as the restore point when a mirror is set. */
export const ANILIST_DEFAULT_GRAPHQL_URL = 'https://graphql.anilist.co'

/** Accepts an http(s) origin with an optional path. */
export function matchesHttpUrlFormat(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export interface AnilistSettingsFormState {
  graphqlUrl: string
  /** Prefer the romaji title over the English one outside Japanese content locales. */
  preferRomajiTitles: boolean
  timeoutSeconds: number
  retryCount: number
  /** Push local status and score changes to the AniList lists automatically. */
  syncEnabled: boolean
  /** Include the local score when pushing. */
  syncPushScore: boolean
}

export interface AnilistAccountState {
  configured: boolean
  /** Epoch ms; AniList tokens live about a year and cannot be refreshed. */
  expiresAt?: number
  /** Set while a browser sign-in is waiting to be completed. */
  loginPending: boolean
}

export interface AnilistAccountVerification {
  userId: number
  userName: string
}

export type AnilistAutomationKind = 'auth-check' | 'push-full-daily' | 'import-refresh-weekly'

export type AnilistAutomationStatus = 'missing' | 'enabled' | 'disabled'

export interface AnilistAutomationState {
  kind: AnilistAutomationKind
  status: AnilistAutomationStatus
}

export interface AnilistSettingsOverview {
  form: AnilistSettingsFormState
  account: AnilistAccountState
  automations: readonly AnilistAutomationState[]
  /** Operations of the extension's currently active task runs. */
  runningOperations: readonly string[]
}

export interface AnilistProfileOption {
  id: string
  name: string
}

/** Profiles selectable for created entries, grouped per local media type. */
export interface AnilistProfileOptions {
  anime: AnilistProfileOption[]
  comic: AnilistProfileOption[]
  novel: AnilistProfileOption[]
}

export interface AnilistImportRequest {
  /** Which AniList lists to read. */
  lists: ('anime' | 'manga')[]
  updateExisting: boolean
  createMissing: boolean
  animeProfileId?: string
  comicProfileId?: string
  novelProfileId?: string
}

/** Task-run projection the settings webview polls while an operation runs. */
export interface AnilistTaskStateView {
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
export interface AnilistSettingsHostFunctions {
  getOverview(): Promise<AnilistSettingsOverview>
  saveSettings(form: AnilistSettingsFormState): Promise<void>
  /** Opens the browser sign-in through the relay. */
  startLogin(): Promise<AnilistAccountState>
  /** Completes a pending sign-in when the deeplink hop was missed. */
  completePendingLogin(): Promise<AnilistAccountState>
  cancelPendingLogin(): Promise<AnilistAccountState>
  logout(): Promise<AnilistAccountState>
  /** Validates the stored token against the Viewer query. */
  verifyAccount(): Promise<AnilistAccountVerification>
  listProfileOptions(): Promise<AnilistProfileOptions>
  startImport(request: AnilistImportRequest): Promise<{ runId: string }>
  startPushAll(): Promise<{ runId: string }>
  getTaskState(runId: string): Promise<AnilistTaskStateView | null>
  cancelTask(runId: string): Promise<boolean>
  /** Creates one recommended app-owned automation for an AniList command. */
  createAutomation(kind: AnilistAutomationKind): Promise<void>
  resetSettings(): Promise<void>
  openExternal(url: string): Promise<void>
}
