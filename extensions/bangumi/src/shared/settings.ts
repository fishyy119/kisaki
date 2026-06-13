import type { JsonObject } from '@kisaki3/extension-sdk'

/**
 * Webview RPC contract between the extension host entry and the settings
 * webview document. Both sides live in this project and import these types
 * directly.
 */

export const BANGUMI_SETTINGS_ENTRY = 'settings/index.html'

export interface BangumiJobPreviewLink extends JsonObject {
  label: string
  href: string
}

export type BangumiJobPreviewTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface BangumiJobPreviewBadge extends JsonObject {
  label: string
  tone: BangumiJobPreviewTone
}

export interface BangumiJobPreviewRow extends JsonObject {
  label: string
  before: string
  after: string
  tone: BangumiJobPreviewTone
}

export interface BangumiJobPreviewGroup extends JsonObject {
  id: string
  title: string
  link: BangumiJobPreviewLink
  badges: readonly BangumiJobPreviewBadge[]
  rows: readonly BangumiJobPreviewRow[]
}

export type BangumiAutoSyncItem = 'create' | 'status' | 'score'

export type BangumiSyncDataItem = 'status' | 'score'

export type BangumiImportDataItem = 'status' | 'score' | 'tags'

export type BangumiAutomationKind = 'auth-refresh' | 'sync-changed' | 'sync-full-daily'

export type BangumiAutomationStatus = 'missing' | 'enabled' | 'disabled'

export interface BangumiSettingsFormState {
  autoSyncEnabled: boolean
  autoSyncItems: readonly BangumiAutoSyncItem[]
  clearRemoteScoreWhenEmpty: boolean
  loginTimeoutMinutes: number
  rateLimitMaxRequests: number
  rateLimitWindowSeconds: number
  timeoutSeconds: number
  retryCount: number
  debounceSeconds: number
  notifyErrors: boolean
}

export interface BangumiAccountState {
  loggedIn: boolean
  nickname: string | null
  username: string | null
  hasToken: boolean
  hasRefreshToken: boolean
  expiresAt: number | null
  expired: boolean
}

export interface BangumiActiveJobsState {
  accountRefresh: boolean
  syncChangedItems: boolean
  syncFull: boolean
  importCollections: boolean
  importIndex: boolean
}

export interface BangumiOptionItem {
  value: string
  label: string
}

export interface BangumiAutomationState {
  kind: BangumiAutomationKind
  status: BangumiAutomationStatus
}

export interface BangumiSettingsOverview {
  form: BangumiSettingsFormState
  account: BangumiAccountState
  activeJobs: BangumiActiveJobsState
  profiles: readonly BangumiOptionItem[]
  collections: readonly BangumiOptionItem[]
  automations: readonly BangumiAutomationState[]
}

export type BangumiPreviewGroupDto = BangumiJobPreviewGroup

export interface BangumiFullSyncFormArgs {
  items: readonly BangumiSyncDataItem[]
  updateExisting: boolean
  clearRemoteScoreWhenEmpty: boolean
  batchSize: number
}

export interface BangumiImportCollectionsFormArgs {
  profileId: string
  collectionTypes: readonly number[]
  dataItems: readonly BangumiImportDataItem[]
  patchExisting: boolean
  targetCollectionId: string | null
}

export type BangumiImportIndexTargetMode = 'none' | 'existing' | 'byIndexTitle'

export interface BangumiImportIndexFormArgs {
  profileId: string
  indexInput: string
  patchExisting: boolean
  targetCollectionMode: BangumiImportIndexTargetMode
  targetCollectionId: string | null
}

/**
 * Functions the extension host exposes to the settings webview.
 */
export interface BangumiSettingsHostFunctions {
  getOverview(): Promise<BangumiSettingsOverview>
  saveSettings(form: BangumiSettingsFormState): Promise<void>
  login(): Promise<void>
  verifyAccount(): Promise<{ nickname: string }>
  refreshCredentials(): Promise<void>
  logout(): Promise<void>
  runChangedSync(): Promise<void>
  previewFullSync(args: BangumiFullSyncFormArgs): Promise<readonly BangumiPreviewGroupDto[]>
  runFullSync(args: BangumiFullSyncFormArgs): Promise<void>
  previewImportCollections(
    args: BangumiImportCollectionsFormArgs
  ): Promise<readonly BangumiPreviewGroupDto[]>
  runImportCollections(args: BangumiImportCollectionsFormArgs): Promise<void>
  previewImportIndex(args: BangumiImportIndexFormArgs): Promise<readonly BangumiPreviewGroupDto[]>
  runImportIndex(args: BangumiImportIndexFormArgs): Promise<void>
  createAutomation(kind: BangumiAutomationKind): Promise<void>
  clearSyncState(): Promise<void>
  resetSettings(): Promise<void>
}

/**
 * Functions the settings webview exposes to the extension host. Jobs and
 * previews run in this same host process, so refreshes and preview progress
 * are pushed straight into the document.
 */
export interface BangumiSettingsUiFunctions {
  refreshRequested(reason: string): void
  previewProgress(label: string): void
}
