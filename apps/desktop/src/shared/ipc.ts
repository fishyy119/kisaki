/**
 * IPC type definitions and result types
 *
 * Defines all IPC channels and their type contracts.
 *
 * Defines application-owned IPC interfaces shared between main, preload, and renderer.
 */

import type { CropRegion } from './attachment'
import type { AttachmentInput } from './db/attachment'
import type { TableName } from './db/table-names'
import type { NameExtractionRule, SaveBackup } from './db/json-types'
import type { MainWindowCloseAction } from './db/enums'
import type {
  EntityDeletePreview,
  EntityDeletePreviewRequest,
  EntityDeleteRequest,
  EntityDeleteResult
} from './entity-delete'
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
import type { ScanProgressData, ExtractionTestResult } from './scanner'
import type {
  IngestAddGameDirectOptions,
  IngestAddGameDirectResult,
  IngestAddGameDirectSeed,
  IngestAddCharacterFromScraperOptions,
  IngestAddCharacterFromScraperResult,
  IngestAddCompanyFromScraperOptions,
  IngestAddCompanyFromScraperResult,
  IngestAddGameFromScraperOptions,
  IngestAddGameFromScraperResult,
  IngestAddPersonFromScraperOptions,
  IngestAddPersonFromScraperResult
} from './ingest/add'
import type {
  CharacterUpdateRequest,
  CompanyUpdateRequest,
  GameUpdateRequest,
  PersonUpdateRequest
} from './ingest/update'
import type { GameRunningStatus } from './monitor'
import type { PortableStatus, PortableSwitchTarget } from './portable'
import type {
  ExtensionCatalogSearchRequest,
  ExtensionCatalogSearchResult,
  ExtensionContributionSnapshot,
  ExtensionCreateInstallPlanRequest,
  ExtensionEntityMenuInvokeRequest,
  ExtensionEntityMenuInvokeResponse,
  ExtensionEntityMenuRefreshRequestedEvent,
  ExtensionEntityMenuReleaseRequest,
  ExtensionEntityMenuResolveRequest,
  ExtensionInstallPlan,
  ExtensionInstallFromFileRequest,
  ExtensionInstallReleaseRequest,
  ExtensionInstalledPackageInfo,
  ExtensionPurgeDataRequest,
  ExtensionRepositoryCreateRequest,
  ExtensionRepositoryInfo,
  ExtensionRepositoryRefreshResult,
  ExtensionRepositoryUpdateRequest,
  ExtensionResolvedEntityMenu,
  ExtensionSettingsPanelRegistrationInfo,
  ExtensionSettingsPanelCallbackResponse,
  ExtensionSettingsPanelInvokeRequest,
  ExtensionSettingsPanelOpenRequest,
  ExtensionSettingsPanelOpenResponse,
  ExtensionSettingsPanelRefreshRequest,
  ExtensionSettingsPanelRefreshResponse,
  ExtensionSettingsPanelRefreshRequestedEvent,
  ExtensionSettingsPanelReleaseRequest,
  ExtensionSettingsPanelSubmitRequest,
  ExtensionThemeRegistrationInfo,
  ExtensionTrustedSignerInfo,
  ExtensionUpdateAllResult,
  ExtensionUpdateCheckResult,
  ExtensionUpdatePolicyRequest,
  ExtensionUpdateRequest
} from './extension'
import type { NotifyOptions } from './notify'
import type { AppEvents } from './events'
import type { AppUpdaterChangelogBundle, AppUpdaterState } from './updater'
import type {
  CommandExecutionRequest,
  CommandExecutionResult,
  CommandExecutionStartResult,
  CommandListItem
} from './command'
import type {
  BackgroundTask,
  BackgroundTaskCreateInput,
  BackgroundTaskRunRecord,
  BackgroundTaskUpdateInput
} from './background-task'
import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import type {
  DeeplinkResult,
  DeeplinkRouteInfo,
  DeeplinkNavigatePayload,
  DeeplinkAuthCallbackPayload,
  DeeplinkAuthErrorPayload
} from './deeplink'
import type { BootstrapArgs } from './bootstrap'

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
 * Failed IPC result with error message
 */
export interface IpcError {
  success: false
  error: string
}

/**
 * Generic IPC result type
 */
export type IpcResult<T = void> = T extends void
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
  'scanner:scan-game': [scannerId: string]
  'scanner:scan-all-game': []
  'notify:native': [NotifyOptions]
  'notify:auto': [NotifyOptions]
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
  'updater:check-for-updates': () => IpcVoidResult
  'updater:download-update': () => IpcVoidResult
  'updater:reload-settings': () => IpcVoidResult
  'updater:quit-and-install': () => IpcVoidResult

  // Commands
  'command:list': () => IpcResult<CommandListItem[]>
  'command:start': (request: CommandExecutionRequest) => IpcResult<CommandExecutionStartResult>
  'command:wait': (executionId: string) => IpcResult<CommandExecutionResult>
  'command:execute': (request: CommandExecutionRequest) => IpcResult<CommandExecutionResult>
  'command:cancel': (executionId: string) => IpcResult<boolean>

  // Background tasks
  'background-task:list': () => IpcResult<BackgroundTask[]>
  'background-task:get': (taskId: string) => IpcResult<BackgroundTask | null>
  'background-task:create': (input: BackgroundTaskCreateInput) => IpcResult<BackgroundTask>
  'background-task:update': (
    taskId: string,
    patch: BackgroundTaskUpdateInput
  ) => IpcResult<BackgroundTask>
  'background-task:set-enabled': (taskId: string, enabled: boolean) => IpcResult<BackgroundTask>
  'background-task:delete': (taskId: string) => IpcVoidResult
  'background-task:run': (taskId: string) => IpcResult<BackgroundTaskRunRecord>
  'background-task:cancel': (taskId: string) => IpcResult<boolean>

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
  'db:rebuild-fts': (entityType?: 'game' | 'character' | 'person' | 'company') => IpcVoidResult
  'db:preview-entity-delete': (params: EntityDeletePreviewRequest) => IpcResult<EntityDeletePreview>
  'db:delete-entities': (params: EntityDeleteRequest) => IpcResult<EntityDeleteResult>

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
  ) => IpcResult<IngestAddGameDirectResult>
  'ingest:add-game-from-scraper': (
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddGameFromScraperOptions
  ) => IpcResult<IngestAddGameFromScraperResult>
  'ingest:add-person-from-scraper': (
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddPersonFromScraperOptions
  ) => IpcResult<IngestAddPersonFromScraperResult>
  'ingest:add-company-from-scraper': (
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddCompanyFromScraperOptions
  ) => IpcResult<IngestAddCompanyFromScraperResult>
  'ingest:add-character-from-scraper': (
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddCharacterFromScraperOptions
  ) => IpcResult<IngestAddCharacterFromScraperResult>

  // Ingest update
  'ingest:update-game-from-scraper': (request: GameUpdateRequest) => IpcVoidResult
  'ingest:update-person-from-scraper': (request: PersonUpdateRequest) => IpcVoidResult
  'ingest:update-company-from-scraper': (request: CompanyUpdateRequest) => IpcVoidResult
  'ingest:update-character-from-scraper': (request: CharacterUpdateRequest) => IpcVoidResult

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
  'monitor:get-game-status': (gameId?: string) => IpcResult<GameRunningStatus | GameRunningStatus[]>
  'monitor:compute-effective-path': (config: {
    monitorPath: string | null
    monitorMode: 'folder' | 'file' | 'process'
    gameDirPath: string | null
    launcherMode: 'file' | 'url' | 'exec'
    launcherPath: string | null
  }) => IpcResult<string | null>

  // Launcher
  'launcher:kill-game': (gameId: string) => IpcVoidResult
  'launcher:launch-game': (gameId: string) => IpcVoidResult
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
  'extension:create-install-plan': (
    request: ExtensionCreateInstallPlanRequest
  ) => IpcResult<ExtensionInstallPlan>
  'extension:install-release': (request: ExtensionInstallReleaseRequest) => IpcVoidResult
  'extension:install-from-file': (request: ExtensionInstallFromFileRequest) => IpcVoidResult
  'extension:uninstall': (extensionId: string) => IpcVoidResult
  'extension:purge-data': (request: ExtensionPurgeDataRequest) => IpcVoidResult
  'extension:check-updates': () => IpcResult<ExtensionUpdateCheckResult>
  'extension:update': (request: ExtensionUpdateRequest) => IpcVoidResult
  'extension:update-all': () => IpcResult<ExtensionUpdateAllResult[]>
  'extension:set-update-policy': (request: ExtensionUpdatePolicyRequest) => IpcVoidResult
  'extension:cancel-operation': (operationId: string) => IpcResult<boolean>
  'extension:reload': (extensionId: string) => IpcVoidResult
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
  'extension:refresh-repository': (
    repositoryId: string
  ) => IpcResult<ExtensionRepositoryRefreshResult>
  'extension:refresh-repositories': () => IpcResult<readonly ExtensionRepositoryRefreshResult[]>
  'extension:search-catalog': (
    request?: ExtensionCatalogSearchRequest
  ) => IpcResult<ExtensionCatalogSearchResult>
  'extension:get-contribution-snapshot': () => IpcResult<ExtensionContributionSnapshot>
  'extension:get-settings-panel-contributions': () => IpcResult<
    readonly ExtensionSettingsPanelRegistrationInfo[]
  >
  'extension:resolve-entity-menu': (
    request: ExtensionEntityMenuResolveRequest
  ) => IpcResult<ExtensionResolvedEntityMenu>
  'extension:invoke-entity-menu': (
    request: ExtensionEntityMenuInvokeRequest
  ) => IpcResult<ExtensionEntityMenuInvokeResponse>
  'extension:release-entity-menu': (request: ExtensionEntityMenuReleaseRequest) => IpcVoidResult
  'extension:open-settings-panel': (
    request: ExtensionSettingsPanelOpenRequest
  ) => IpcResult<ExtensionSettingsPanelOpenResponse>
  'extension:refresh-settings-panel': (
    request: ExtensionSettingsPanelRefreshRequest
  ) => IpcResult<ExtensionSettingsPanelRefreshResponse>
  'extension:submit-settings-panel': (
    request: ExtensionSettingsPanelSubmitRequest
  ) => IpcResult<ExtensionSettingsPanelCallbackResponse>
  'extension:invoke-settings-panel-node': (
    request: ExtensionSettingsPanelInvokeRequest
  ) => IpcResult<ExtensionSettingsPanelCallbackResponse>
  'extension:release-settings-panel': (
    request: ExtensionSettingsPanelReleaseRequest
  ) => IpcVoidResult
  'extension:get-theme-contributions': () => IpcResult<readonly ExtensionThemeRegistrationInfo[]>

  // Scanner
  'scanner:get-active-scans': () => IpcResult<ScanProgressData[]>
  'scanner:pause-game': (scannerId: string) => IpcVoidResult
  'scanner:resume-game': (scannerId: string) => IpcVoidResult
  'scanner:abort-game': (scannerId: string) => IpcVoidResult
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
  'scanner:scan-progress': [ScanProgressData]
  'updater:state-changed': [state: AppUpdaterState]

  'notify:show': [NotifyOptions & { toastId?: string }]
  'notify:loading': [{ toastId: string; title: string; message?: string }]
  'notify:update': [{ toastId: string } & NotifyOptions]
  'notify:dismiss': [{ toastId?: string }]

  // Extension contribution refresh (main -> renderer)
  'extension:repositories-changed': []
  'extension:catalog-changed': []
  'extension:installations-changed': []
  'extension:trusted-signers-changed': []
  'extension:contributions-changed': [snapshot: ExtensionContributionSnapshot]
  'extension:settings-panels-refresh-requested': [
    event: ExtensionSettingsPanelRefreshRequestedEvent
  ]
  'extension:entity-menus-refresh-requested': [event: ExtensionEntityMenuRefreshRequestedEvent]

  // Deeplink events (main → renderer)
  'deeplink:navigate': [DeeplinkNavigatePayload]
  'deeplink:auth-callback': [DeeplinkAuthCallbackPayload]
  'deeplink:auth-error': [DeeplinkAuthErrorPayload]
}
