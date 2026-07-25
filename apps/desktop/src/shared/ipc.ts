/**
 * IPC type definitions and result types
 *
 * Defines all IPC channels and their type contracts.
 *
 * Defines application-owned IPC interfaces shared between main, preload, and renderer.
 */

import type { CropRegion } from './attachment'
import type { AttachmentInput } from './db/contracts/attachment'
import type { TableName } from './db/table-names'
import type { NameExtractionRule, SaveBackup } from './db/contracts/json'
import type { MainWindowCloseAction } from './db/contracts/enums'
import type { FtsEntityType } from './db/contracts/fts'
import type {
  EntityDeletePreview,
  EntityDeletePreviewRequest,
  EntityDeleteRequest,
  EntityDeleteResult
} from './entity-delete'
import type { EntityMergeRequest, EntityMergeResult } from './entity-merge'
import type {
  ScraperLookup,
  GameSearchResult,
  GameScraperProviderInfo,
  PersonSearchResult,
  PersonScraperProviderInfo,
  CompanySearchResult,
  CompanyScraperProviderInfo,
  CharacterSearchResult,
  CharacterScraperProviderInfo,
  GameImageSlot,
  ScrapedGameBundle,
  ScraperProfileListQuery,
  ScraperProfileSummary,
  ScrapedPersonBundle,
  ScrapedCompanyBundle,
  ScrapedCharacterBundle
} from './scraper'
import type { ExtractionTestResult, ScannerRunStartResult, ScannerRunState } from './scanner'
import type {
  IngestAddGameDirectOptions,
  IngestAddGameDirectSeed,
  IngestAddCharacterFromScraperOptions,
  IngestAddCompanyFromScraperOptions,
  IngestAddGameFromScraperOptions,
  IngestAddPersonFromScraperOptions
} from './ingest/add'
import type {
  CharacterBatchUpdateRequest,
  CharacterUpdateRequest,
  CompanyBatchUpdateRequest,
  CompanyUpdateRequest,
  GameBatchUpdateRequest,
  GameUpdateRequest,
  PersonBatchUpdateRequest,
  PersonUpdateRequest
} from './ingest/update'
import type { GameMonitorPathConfig, GameRunningStatus } from './monitor'
import type { PortableStatus, PortableSwitchTarget } from './portable'
import type {
  ExtensionCatalogSearchRequest,
  ExtensionCatalogSearchResult,
  ExtensionContributionSnapshot,
  ExtensionCreateReleasePlanRequest,
  ExtensionDevelopmentStaleChangedEvent,
  ExtensionEntityMenuInvokeRequest,
  ExtensionEntityMenuInvokeResponse,
  ExtensionEntityMenuRefreshRequestedEvent,
  ExtensionEntityMenuReleaseRequest,
  ExtensionEntityMenuResolveRequest,
  ExtensionReleasePlan,
  ExtensionApplyReleaseRequest,
  ExtensionInstalledPackageInfo,
  ExtensionPurgeDataRequest,
  ExtensionRepositoryCreateRequest,
  ExtensionRepositoryInfo,
  ExtensionRepositoryUpdateRequest,
  ExtensionResolvedEntityMenu,
  ExtensionRuntimeStateChangedEvent,
  ExtensionCardActionRunRequest,
  ExtensionThemeRegistrationInfo,
  ExtensionWebviewCloseRequest,
  ExtensionWebviewMessageEvent,
  ExtensionWebviewPostMessageRequest,
  ExtensionWebviewReadyRequest,
  ExtensionWebviewSessionInfo,
  ExtensionTrustedSignerInfo,
  ExtensionAutomaticUpdateRunState,
  ExtensionUpdateCheckResult,
  ExtensionUpdatePolicyRequest
} from './extension'
import type { NotifyOptions } from './notify'
import type { UiLocale, UiLocaleState } from './i18n'
import type { AppEvents } from './events'
import type { AppUpdaterChangelogBundle, AppUpdaterState } from './updater'
import type {
  TaskRun,
  TaskRunActiveListQuery,
  TaskRunHistoryListQuery,
  TaskRunStartResult
} from './task-run'
import type {
  CommandDescriptor,
  CommandInvocationRequest,
  CommandInvocationResult,
  CommandListItem
} from './command'
import type {
  Automation,
  AutomationCreateInput,
  AutomationRunHistoryRecord,
  AutomationUpdateInput
} from './automation'
import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import type {
  DeeplinkResult,
  DeeplinkRouteInfo,
  DeeplinkNavigatePayload,
  DeeplinkAuthCallbackPayload,
  DeeplinkAuthErrorPayload
} from './deeplink'
import type { BootstrapArgs } from './bootstrap'
import type { GameLaunchResult, GameStopResult } from './launcher'

// =============================================================================
// IPC Result Types
// =============================================================================

/**
 * Successful IPC result with data
 */
export interface IpcSuccess<T = void> {
  success: true
  data: T
}

/**
 * Successful IPC result without data (for void operations)
 */
export interface IpcSuccessVoid {
  success: true
}

/**
 * Failed IPC result with a safe, user-visible English message.
 */
export interface IpcError {
  success: false
  error: string
}

/**
 * Generic IPC result type
 */
export type IpcResult<T = void> = [T] extends [void]
  ? IpcSuccessVoid | IpcError
  : IpcSuccess<T> | IpcError

/**
 * Alias for IpcResult<void> for better readability
 */
export type IpcVoidResult = IpcResult<void>

/**
 * Extract the data type from an IpcResult
 */
export type ExtractIpcData<T> = T extends IpcSuccess<infer D> ? D : never

// =============================================================================
// IPC Interfaces (extensible via declaration merging)
// =============================================================================

/**
 * IPC listeners - main process receives, no response.
 *
 * This interface is exported and can be extended via declaration merging.
 * Each listener maps to a tuple of its argument types.
 */
export interface IpcMainListeners {
  ping: [string]
  'event:forward': [event: keyof AppEvents, args: unknown[]]
  'notify:native': [NotifyOptions]
  'notify:auto': [NotifyOptions]
  'notify:action': [event: { toastId: string; actionId: string }]
  'notify:closed': [event: { toastId: string }]
  'native:set-tray-menu-height': [height: number]
  'window:set-main-window-close-action': [action: MainWindowCloseAction]
}

/**
 * IPC handlers - main process receives, returns response.
 *
 * This interface is exported and can be extended via declaration merging.
 * Each handler maps to its function signature.
 */
export interface IpcMainHandlers {
  // App bootstrap
  'app:get-version': () => IpcResult<string>
  'app:get-bootstrap-args': () => IpcResult<BootstrapArgs>
  'app:quit': () => IpcVoidResult
  'updater:get-state': () => IpcResult<AppUpdaterState>
  'updater:get-changelog': (version: string) => IpcResult<AppUpdaterChangelogBundle>
  'updater:check-for-updates': () => IpcResult<TaskRunStartResult>
  'updater:download-update': () => IpcResult<TaskRunStartResult>
  'updater:reload-settings': () => IpcVoidResult
  'updater:quit-and-install': () => IpcVoidResult

  // I18n
  'i18n:get-state': () => IpcResult<UiLocaleState>
  'i18n:set-preference': (preference: UiLocale | null) => IpcVoidResult

  // Task runs
  'task-run:list-active': (query?: TaskRunActiveListQuery) => IpcResult<TaskRun[]>
  'task-run:list-history': (query?: TaskRunHistoryListQuery) => IpcResult<TaskRun[]>
  'task-run:get-active': (runId: string) => IpcResult<TaskRun | null>
  'task-run:get-history': (runId: string) => IpcResult<TaskRun | null>
  'task-run:wait': (runId: string) => IpcResult<TaskRun>
  'task-run:cancel': (runId: string) => IpcResult<boolean>
  'task-run:pause': (runId: string) => IpcResult<boolean>
  'task-run:resume': (runId: string) => IpcResult<boolean>
  'task-run:delete-history': (runId: string) => IpcVoidResult
  'task-run:clear-completed': () => IpcVoidResult

  // Commands
  'command:list': () => IpcResult<CommandListItem[]>
  'command:get': (commandId: string) => IpcResult<CommandDescriptor | null>
  'command:invoke': (request: CommandInvocationRequest) => IpcResult<CommandInvocationResult>

  // automations
  'automation:list': () => IpcResult<Automation[]>
  'automation:list-running': () => IpcResult<string[]>
  'automation:get': (automationId: string) => IpcResult<Automation | null>
  'automation:create': (input: AutomationCreateInput) => IpcResult<Automation>
  'automation:update': (automationId: string, patch: AutomationUpdateInput) => IpcResult<Automation>
  'automation:set-enabled': (automationId: string, enabled: boolean) => IpcResult<Automation>
  'automation:delete': (automationId: string) => IpcVoidResult
  'automation:run': (automationId: string) => IpcResult<AutomationRunHistoryRecord | null>
  'automation:cancel': (automationId: string) => IpcResult<boolean>

  // Debug mode
  'debug:get-mode': () => IpcResult<boolean>
  'debug:is-inspector-active': () => IpcResult<boolean>
  'debug:get-ports': () => IpcResult<{ main: number; renderer: number }>

  // Main window management
  'window:minimize-main-window': () => IpcVoidResult
  'window:toggle-main-window-maximize': () => IpcVoidResult
  'window:close-main-window': () => IpcVoidResult

  // Database proxy
  'db:execute': (
    sqlstr: string,
    params: unknown[],
    method: 'run' | 'all' | 'values' | 'get'
  ) => IpcResult<unknown[]>
  'db:rebuild-fts': (entityType: FtsEntityType) => IpcVoidResult
  'db:rebuild-all-fts': () => IpcVoidResult
  'db:preview-entity-delete': (params: EntityDeletePreviewRequest) => IpcResult<EntityDeletePreview>
  'db:delete-entities': (params: EntityDeleteRequest) => IpcResult<EntityDeleteResult>
  'db:merge-entities': (params: EntityMergeRequest) => IpcResult<EntityMergeResult>

  // DB attachment (DbService.attachment)
  /**
   * NOTE (typing / IPC limitation):
   * - IPC payloads must be serializable, so we cannot pass a Drizzle `table` object here.
   *   We pass `TableName` and resolve to the real table in the main process.
   * - `field` cannot be expressed as `FileColumns<TTable>` / `FilesColumns<TTable>` at this layer
   *   because `IpcMainHandlers` has no generic context to tie `table` -> `field` for TS inference.
   *   Renderer-side clients should expose precise, table-aware APIs (and they do).
   */
  'db:attachment-set-file': (
    table: TableName,
    rowId: string,
    field: string,
    input: AttachmentInput
  ) => IpcResult<string>
  'db:attachment-clear-file': (table: TableName, rowId: string, field: string) => IpcVoidResult
  'db:attachment-add-file': (
    table: TableName,
    rowId: string,
    field: string,
    input: AttachmentInput
  ) => IpcResult<string>
  'db:attachment-remove-file': (
    table: TableName,
    rowId: string,
    field: string,
    fileName: string
  ) => IpcVoidResult
  'db:attachment-list-files': (
    table: TableName,
    rowId: string,
    field: string
  ) => IpcResult<string[]>
  'db:attachment-clear-files': (table: TableName, rowId: string, field: string) => IpcVoidResult
  'db:attachment-cleanup-row': (table: TableName, rowId: string) => IpcVoidResult
  'db:attachment-get-path': (table: TableName, rowId: string, fileName: string) => IpcResult<string>

  // Ingest
  'ingest:add-game-direct': (
    seed: IngestAddGameDirectSeed,
    options?: IngestAddGameDirectOptions
  ) => IpcResult<TaskRunStartResult>
  'ingest:add-game-from-scraper': (
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddGameFromScraperOptions
  ) => IpcResult<TaskRunStartResult>
  'ingest:add-person-from-scraper': (
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddPersonFromScraperOptions
  ) => IpcResult<TaskRunStartResult>
  'ingest:add-company-from-scraper': (
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddCompanyFromScraperOptions
  ) => IpcResult<TaskRunStartResult>
  'ingest:add-character-from-scraper': (
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddCharacterFromScraperOptions
  ) => IpcResult<TaskRunStartResult>

  // Ingest update
  'ingest:update-game-from-scraper': (request: GameUpdateRequest) => IpcResult<TaskRunStartResult>
  'ingest:update-person-from-scraper': (
    request: PersonUpdateRequest
  ) => IpcResult<TaskRunStartResult>
  'ingest:update-company-from-scraper': (
    request: CompanyUpdateRequest
  ) => IpcResult<TaskRunStartResult>
  'ingest:update-character-from-scraper': (
    request: CharacterUpdateRequest
  ) => IpcResult<TaskRunStartResult>
  'ingest:batch-update-game-from-scraper': (
    request: GameBatchUpdateRequest
  ) => IpcResult<TaskRunStartResult>
  'ingest:batch-update-person-from-scraper': (
    request: PersonBatchUpdateRequest
  ) => IpcResult<TaskRunStartResult>
  'ingest:batch-update-company-from-scraper': (
    request: CompanyBatchUpdateRequest
  ) => IpcResult<TaskRunStartResult>
  'ingest:batch-update-character-from-scraper': (
    request: CharacterBatchUpdateRequest
  ) => IpcResult<TaskRunStartResult>

  // Scraper
  'scraper:list-profiles': (query?: ScraperProfileListQuery) => IpcResult<ScraperProfileSummary[]>
  'scraper:get-profile': (profileId: string) => IpcResult<ScraperProfileSummary | null>
  'scraper:list-game-providers': () => IpcResult<GameScraperProviderInfo[]>
  'scraper:get-game-provider': (providerId: string) => IpcResult<GameScraperProviderInfo>
  'scraper:search-game': (profileId: string, query: string) => IpcResult<GameSearchResult[]>
  'scraper:scrape-game': (
    profileId: string,
    lookup: ScraperLookup
  ) => IpcResult<ScrapedGameBundle | null>
  'scraper:get-game-provider-images': (
    providerId: string,
    lookup: ScraperLookup,
    imageType: GameImageSlot
  ) => IpcResult<string[]>

  'scraper:list-person-providers': () => IpcResult<PersonScraperProviderInfo[]>
  'scraper:get-person-provider': (providerId: string) => IpcResult<PersonScraperProviderInfo>
  'scraper:search-person': (profileId: string, query: string) => IpcResult<PersonSearchResult[]>
  'scraper:scrape-person': (
    profileId: string,
    lookup: ScraperLookup
  ) => IpcResult<ScrapedPersonBundle | null>
  'scraper:get-person-provider-images': (
    providerId: string,
    lookup: ScraperLookup,
    imageType: 'photos'
  ) => IpcResult<string[]>

  'scraper:list-company-providers': () => IpcResult<CompanyScraperProviderInfo[]>
  'scraper:get-company-provider': (providerId: string) => IpcResult<CompanyScraperProviderInfo>
  'scraper:search-company': (profileId: string, query: string) => IpcResult<CompanySearchResult[]>
  'scraper:scrape-company': (
    profileId: string,
    lookup: ScraperLookup
  ) => IpcResult<ScrapedCompanyBundle | null>
  'scraper:get-company-provider-images': (
    providerId: string,
    lookup: ScraperLookup,
    imageType: 'logos'
  ) => IpcResult<string[]>

  'scraper:list-character-providers': () => IpcResult<CharacterScraperProviderInfo[]>
  'scraper:get-character-provider': (providerId: string) => IpcResult<CharacterScraperProviderInfo>
  'scraper:search-character': (
    profileId: string,
    query: string
  ) => IpcResult<CharacterSearchResult[]>
  'scraper:scrape-character': (
    profileId: string,
    lookup: ScraperLookup
  ) => IpcResult<ScrapedCharacterBundle | null>
  'scraper:get-character-provider-images': (
    providerId: string,
    lookup: ScraperLookup,
    imageType: 'photos'
  ) => IpcResult<string[]>

  // Monitor
  'monitor:start-game': (gameId: string) => IpcVoidResult
  'monitor:stop-game': (gameId: string) => IpcVoidResult
  'monitor:list-game-statuses': () => IpcResult<GameRunningStatus[]>
  'monitor:get-game-status': (gameId: string) => IpcResult<GameRunningStatus>
  'monitor:compute-effective-path': (config: GameMonitorPathConfig) => IpcResult<string | null>

  // Launcher
  'launcher:kill-game': (gameId: string) => IpcResult<GameStopResult>
  'launcher:launch-game': (gameId: string) => IpcResult<GameLaunchResult>
  'launcher:apply-default-config': (gameId: string, filePath: string) => IpcVoidResult

  // Native dialogs
  'native:open-dialog': (options?: OpenDialogOptions) => IpcResult<OpenDialogReturnValue>
  'native:open-path': (
    input:
      | string
      | {
          path: string
          /** Ensure system opens a folder (never launches an .exe). */
          ensure?: 'auto' | 'folder' | 'file'
        }
  ) => IpcVoidResult
  'native:open-external': (url: string) => IpcVoidResult
  'native:get-auto-launch': () => IpcResult<boolean>
  'native:set-auto-launch': (enabled: boolean) => IpcVoidResult

  // Attachment
  'attachment:crop-to-temp': (
    input: AttachmentInput,
    cropRegion: CropRegion,
    options?: {
      format?: 'keep' | 'png' | 'jpeg' | 'webp'
      quality?: number
    }
  ) => IpcResult<string>

  // Save backup
  'attachment:create-game-backup': (gameId: string, note?: string) => IpcResult<SaveBackup>
  'attachment:delete-game-backup': (gameId: string, backupAt: number) => IpcVoidResult
  'attachment:restore-game-backup': (gameId: string, backupAt: number) => IpcVoidResult
  'attachment:update-game-backup': (
    gameId: string,
    backupAt: number,
    updates: Partial<Pick<SaveBackup, 'note' | 'locked'>>
  ) => IpcVoidResult
  'attachment:open-backup-folder': (gameId: string) => IpcVoidResult
  'attachment:open-save-folder': (gameId: string) => IpcVoidResult

  // Portable mode
  'portable:get-status': () => IpcResult<PortableStatus>
  'portable:get-pending-switch': () => IpcResult<PortableSwitchTarget | null>
  'portable:switch-to-portable': () => IpcVoidResult
  'portable:switch-to-normal': () => IpcVoidResult
  'portable:cancel-pending-switch': () => IpcVoidResult

  // Extension system
  'extension:disable': (extensionId: string) => IpcVoidResult
  'extension:enable': (extensionId: string) => IpcVoidResult
  'extension:is-enabled': (extensionId: string) => IpcResult<boolean>
  'extension:create-release-plan': (
    request: ExtensionCreateReleasePlanRequest
  ) => IpcResult<ExtensionReleasePlan>
  'extension:apply-release': (
    request: ExtensionApplyReleaseRequest
  ) => IpcResult<TaskRunStartResult>
  'extension:uninstall': (extensionId: string) => IpcVoidResult
  'extension:purge-data': (request: ExtensionPurgeDataRequest) => IpcVoidResult
  'extension:check-updates': () => IpcResult<ExtensionUpdateCheckResult>
  'extension:get-automatic-update-run': () => IpcResult<ExtensionAutomaticUpdateRunState>
  'extension:set-update-policy': (request: ExtensionUpdatePolicyRequest) => IpcVoidResult
  'extension:reload': (extensionId: string) => IpcVoidResult
  'extension:restart-host': () => IpcVoidResult
  'extension:get-installed-packages': () => IpcResult<ExtensionInstalledPackageInfo[]>
  'extension:list-trusted-signers': () => IpcResult<readonly ExtensionTrustedSignerInfo[]>
  'extension:remove-trusted-signer': (trustedSignerId: string) => IpcVoidResult
  'extension:list-repositories': () => IpcResult<readonly ExtensionRepositoryInfo[]>
  'extension:add-repository': (
    request: ExtensionRepositoryCreateRequest
  ) => IpcResult<ExtensionRepositoryInfo>
  'extension:update-repository': (
    request: ExtensionRepositoryUpdateRequest
  ) => IpcResult<ExtensionRepositoryInfo>
  'extension:remove-repository': (repositoryId: string) => IpcVoidResult
  'extension:refresh-repository': (repositoryId: string) => IpcResult<TaskRunStartResult>
  'extension:refresh-repositories': () => IpcResult<TaskRunStartResult>
  'extension:search-catalog': (
    request?: ExtensionCatalogSearchRequest
  ) => IpcResult<ExtensionCatalogSearchResult>
  'extension:get-contribution-snapshot': () => IpcResult<ExtensionContributionSnapshot>
  'extension:resolve-entity-menu': (
    request: ExtensionEntityMenuResolveRequest
  ) => IpcResult<ExtensionResolvedEntityMenu>
  'extension:invoke-entity-menu': (
    request: ExtensionEntityMenuInvokeRequest
  ) => IpcResult<ExtensionEntityMenuInvokeResponse>
  'extension:release-entity-menu': (request: ExtensionEntityMenuReleaseRequest) => IpcVoidResult
  'extension:run-card-action': (request: ExtensionCardActionRunRequest) => IpcVoidResult
  'extension:get-webview-sessions': () => IpcResult<readonly ExtensionWebviewSessionInfo[]>
  'extension:post-webview-message': (request: ExtensionWebviewPostMessageRequest) => IpcVoidResult
  'extension:notify-webview-ready': (request: ExtensionWebviewReadyRequest) => IpcVoidResult
  'extension:close-webview': (request: ExtensionWebviewCloseRequest) => IpcVoidResult
  'extension:get-theme-contributions': () => IpcResult<readonly ExtensionThemeRegistrationInfo[]>

  // Scanner
  'scanner:start-game-scan': (scannerId: string) => IpcResult<ScannerRunStartResult>
  'scanner:start-all-game-scans': () => IpcResult<ScannerRunStartResult[]>
  'scanner:list-run-states': () => IpcResult<ScannerRunState[]>
  'scanner:pause-scan': (scannerId: string) => IpcResult<boolean>
  'scanner:resume-scan': (scannerId: string) => IpcResult<boolean>
  'scanner:cancel-scan': (scannerId: string) => IpcResult<boolean>
  'scanner:test-extraction-rules': (
    scannerPath: string,
    entityDepth: number,
    rules: NameExtractionRule[]
  ) => IpcResult<ExtractionTestResult[]>

  // Deeplink
  'deeplink:handle': (url: string) => IpcResult<DeeplinkResult>
  'deeplink:list-routes': () => IpcResult<DeeplinkRouteInfo[]>
}

/**
 * IPC events sent from main to renderer.
 *
 * This interface is exported and can be extended via declaration merging.
 * Each event maps to a tuple of its argument types.
 */
export interface IpcRendererEvents {
  ready: [boolean]
  'event:forward': [event: keyof AppEvents, args: unknown[]]
  'native:main-window-maximized': []
  'native:main-window-unmaximized': []
  'monitor:game-started': [string]
  'monitor:game-stopped': [string]
  'monitor:game-foreground': [string]
  'monitor:game-background': [string]
  'scanner:run-state-changed': [state: ScannerRunState]
  'updater:state-changed': [state: AppUpdaterState]
  'task-run:changed': [run: TaskRun]
  'task-run:deleted': [payload: { runId: string }]

  'notify:show': [NotifyOptions & { toastId?: string }]
  'notify:loading': [{ toastId: string; title: string; message?: string }]
  'notify:update': [{ toastId: string } & NotifyOptions]
  'notify:dismiss': [{ toastId?: string }]

  // Extension contribution refresh (main -> renderer)
  'extension:repositories-changed': []
  'extension:catalog-changed': []
  'extension:installations-changed': []
  'extension:runtime-state-changed': [event: ExtensionRuntimeStateChangedEvent]
  'extension:development-stale-changed': [event: ExtensionDevelopmentStaleChangedEvent]
  'extension:automatic-update-run-changed': [state: ExtensionAutomaticUpdateRunState]
  'extension:trusted-signers-changed': []
  'extension:contributions-changed': [snapshot: ExtensionContributionSnapshot]
  'extension:entity-menus-refresh-requested': [event: ExtensionEntityMenuRefreshRequestedEvent]
  'extension:webview-sessions-changed': [sessions: readonly ExtensionWebviewSessionInfo[]]
  'extension:webview-message': [event: ExtensionWebviewMessageEvent]

  // Deeplink events (main → renderer)
  'deeplink:navigate': [DeeplinkNavigatePayload]
  'deeplink:auth-callback': [DeeplinkAuthCallbackPayload]
  'deeplink:auth-error': [DeeplinkAuthErrorPayload]
}
