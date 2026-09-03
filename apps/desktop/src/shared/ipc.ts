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
  GameScraperLookup,
  GameSearchResult,
  GameScraperProviderInfo,
  AnimeScraperLookup,
  AnimeSearchResult,
  AnimeScraperProviderInfo,
  ComicScraperLookup,
  ComicSearchResult,
  ComicScraperProviderInfo,
  NovelScraperLookup,
  NovelSearchResult,
  NovelScraperProviderInfo,
  PersonSearchResult,
  PersonScraperProviderInfo,
  CompanySearchResult,
  CompanyScraperProviderInfo,
  CharacterSearchResult,
  CharacterScraperProviderInfo,
  GameImageSlot,
  AnimeImageSlot,
  ComicImageSlot,
  NovelImageSlot,
  ScrapedGameBundle,
  ScrapedAnimeBundle,
  ScrapedComicBundle,
  ScrapedNovelBundle,
  ScraperProfileListQuery,
  ScraperProfileSummary,
  ScrapedPersonBundle,
  ScrapedCompanyBundle,
  ScrapedCharacterBundle
} from './scraper'
import type { ExtractionTestResult, ScannerRunStartResult, ScannerRunState } from './scanner'
import type {
  IngestAddAnimeDirectOptions,
  IngestAddAnimeDirectSeed,
  IngestAddAnimeFromScraperOptions,
  IngestAddComicDirectOptions,
  IngestAddComicDirectSeed,
  IngestAddComicFromScraperOptions,
  IngestAddGameDirectOptions,
  IngestAddGameDirectSeed,
  IngestAddCharacterFromScraperOptions,
  IngestAddCompanyFromScraperOptions,
  IngestAddGameFromScraperOptions,
  IngestAddNovelDirectOptions,
  IngestAddNovelDirectSeed,
  IngestAddNovelFromScraperOptions,
  IngestAddPersonFromScraperOptions
} from './ingest/add'
import type {
  AnimeEpisodeFileAttachParams,
  AnimeExtraFileAttachParams,
  AnimeFileSyncParams,
  AnimeFileSyncResult,
  ComicChapterFileAttachParams,
  ComicFileSyncParams,
  ComicFileSyncResult,
  NovelFileSyncParams,
  NovelFileSyncResult,
  NovelVolumeFileAttachParams
} from './holdings'
import type {
  AnimeBatchUpdateRequest,
  AnimeUpdateRequest,
  CharacterBatchUpdateRequest,
  CharacterUpdateRequest,
  ComicBatchUpdateRequest,
  ComicUpdateRequest,
  CompanyBatchUpdateRequest,
  CompanyUpdateRequest,
  GameBatchUpdateRequest,
  GameUpdateRequest,
  NovelBatchUpdateRequest,
  NovelUpdateRequest,
  PersonBatchUpdateRequest,
  PersonUpdateRequest
} from './ingest/update'
import type { PortableStatus, PortableSwitchTarget } from './portable'
import type {
  ExtensionCatalogSearchRequest,
  ExtensionCatalogSearchResult,
  ExtensionContributionSnapshot,
  ExtensionCreateReleasePlanRequest,
  ExtensionDevelopmentStaleState,
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
  ExtensionWebviewOpenPageRequest,
  ExtensionWebviewPostMessageRequest,
  ExtensionWebviewReadyRequest,
  ExtensionWebviewSessionInfo,
  ExtensionTrustedSignerInfo,
  ExtensionAutomaticUpdateRunState,
  ExtensionUpdateCheckResult,
  ExtensionUpdatePolicyRequest
} from './extension'
import type { NotifyOptions } from './notification'
import type { UiLocale, UiLocaleState } from './i18n'
import type { AppTheme } from './theme'
import type { UiScale } from './window'
import type { MediaType } from './entity-types'
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
  AutomationRunStartedEvent,
  AutomationUpdateInput
} from './automation'
import type { ComicBookmark, NovelBookmark, NovelHighlight } from './db'
import type { DbChangeSummary } from './db/changes'
import type { LibraryEntityMergedEvent } from './library'
import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import type { DeeplinkOpenPayload } from './deeplink'
import type { BootstrapArgs } from './bootstrap'
import type {
  AnimeExtraPlayingState,
  AnimeExtraPlayResult,
  AnimeExtraStopResult,
  AnimeStopResult,
  AnimeWatchingState,
  AnimeWatchResult,
  ComicBookmarkInput,
  ComicBookmarkUpdate,
  ComicReadingState,
  GameActivityEvent,
  GameLaunchResult,
  GameMonitorPathConfig,
  GameRunningStatus,
  GameStopResult,
  NovelBookmarkInput,
  NovelBookmarkUpdate,
  NovelHighlightInput,
  NovelHighlightUpdate,
  NovelReadingState,
  ReadingResult,
  ReadingStopResult
} from './activity'
import type { PlaybackEndReport, PlaybackProgress, PlaybackSessionState } from './video'
import type {
  ReaderBootstrap,
  ReaderPageFlowReport,
  ReaderProgressReport,
  ReaderUnitOpenedReport
} from './reader'

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
  'app:theme-changed': [theme: AppTheme]
  'notification:native': [NotifyOptions]
  'notification:auto': [NotifyOptions]
  'notification:action': [event: { toastId: string; actionId: string }]
  'notification:closed': [event: { toastId: string }]
  'window:set-tray-menu-height': [height: number]
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
  'window:get-interface-scale': () => IpcResult<UiScale>
  'window:set-interface-scale': (scale: UiScale) => IpcVoidResult

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
  'db:attachment-get-path': (table: TableName, rowId: string, fileName: string) => IpcResult<string>

  // Ingest
  'ingest:add-game-direct': (
    seed: IngestAddGameDirectSeed,
    options?: IngestAddGameDirectOptions
  ) => IpcResult<TaskRunStartResult>
  'ingest:add-game-from-scraper': (
    profileId: string,
    lookup: GameScraperLookup,
    options?: IngestAddGameFromScraperOptions
  ) => IpcResult<TaskRunStartResult>
  'ingest:add-anime-direct': (
    seed: IngestAddAnimeDirectSeed,
    options?: IngestAddAnimeDirectOptions
  ) => IpcResult<TaskRunStartResult>
  'ingest:add-anime-from-scraper': (
    profileId: string,
    lookup: AnimeScraperLookup,
    options?: IngestAddAnimeFromScraperOptions
  ) => IpcResult<TaskRunStartResult>
  'ingest:add-comic-direct': (
    seed: IngestAddComicDirectSeed,
    options?: IngestAddComicDirectOptions
  ) => IpcResult<TaskRunStartResult>
  'ingest:add-comic-from-scraper': (
    profileId: string,
    lookup: ComicScraperLookup,
    options?: IngestAddComicFromScraperOptions
  ) => IpcResult<TaskRunStartResult>
  'ingest:add-novel-direct': (
    seed: IngestAddNovelDirectSeed,
    options?: IngestAddNovelDirectOptions
  ) => IpcResult<TaskRunStartResult>
  'ingest:add-novel-from-scraper': (
    profileId: string,
    lookup: NovelScraperLookup,
    options?: IngestAddNovelFromScraperOptions
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
  'ingest:update-anime-from-scraper': (request: AnimeUpdateRequest) => IpcResult<TaskRunStartResult>
  'ingest:update-comic-from-scraper': (request: ComicUpdateRequest) => IpcResult<TaskRunStartResult>
  'ingest:update-novel-from-scraper': (request: NovelUpdateRequest) => IpcResult<TaskRunStartResult>
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
  'ingest:batch-update-anime-from-scraper': (
    request: AnimeBatchUpdateRequest
  ) => IpcResult<TaskRunStartResult>
  'ingest:batch-update-comic-from-scraper': (
    request: ComicBatchUpdateRequest
  ) => IpcResult<TaskRunStartResult>
  'ingest:batch-update-novel-from-scraper': (
    request: NovelBatchUpdateRequest
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
    lookup: GameScraperLookup
  ) => IpcResult<ScrapedGameBundle | null>
  'scraper:get-game-provider-images': (
    providerId: string,
    lookup: GameScraperLookup,
    imageType: GameImageSlot
  ) => IpcResult<string[]>

  'scraper:list-anime-providers': () => IpcResult<AnimeScraperProviderInfo[]>
  'scraper:get-anime-provider': (providerId: string) => IpcResult<AnimeScraperProviderInfo>
  'scraper:search-anime': (profileId: string, query: string) => IpcResult<AnimeSearchResult[]>
  'scraper:scrape-anime': (
    profileId: string,
    lookup: AnimeScraperLookup
  ) => IpcResult<ScrapedAnimeBundle | null>
  'scraper:get-anime-provider-images': (
    providerId: string,
    lookup: AnimeScraperLookup,
    imageType: AnimeImageSlot
  ) => IpcResult<string[]>

  'scraper:list-comic-providers': () => IpcResult<ComicScraperProviderInfo[]>
  'scraper:get-comic-provider': (providerId: string) => IpcResult<ComicScraperProviderInfo>
  'scraper:search-comic': (profileId: string, query: string) => IpcResult<ComicSearchResult[]>
  'scraper:scrape-comic': (
    profileId: string,
    lookup: ComicScraperLookup
  ) => IpcResult<ScrapedComicBundle | null>
  'scraper:get-comic-provider-images': (
    providerId: string,
    lookup: ComicScraperLookup,
    imageType: ComicImageSlot
  ) => IpcResult<string[]>

  'scraper:list-novel-providers': () => IpcResult<NovelScraperProviderInfo[]>
  'scraper:get-novel-provider': (providerId: string) => IpcResult<NovelScraperProviderInfo>
  'scraper:search-novel': (profileId: string, query: string) => IpcResult<NovelSearchResult[]>
  'scraper:scrape-novel': (
    profileId: string,
    lookup: NovelScraperLookup
  ) => IpcResult<ScrapedNovelBundle | null>
  'scraper:get-novel-provider-images': (
    providerId: string,
    lookup: NovelScraperLookup,
    imageType: NovelImageSlot
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

  // Activity
  'activity:launch-game': (gameId: string) => IpcResult<GameLaunchResult>
  'activity:stop-game': (gameId: string) => IpcResult<GameStopResult>
  'activity:list-game-statuses': () => IpcResult<GameRunningStatus[]>
  'activity:compute-game-monitor-path': (config: GameMonitorPathConfig) => IpcResult<string | null>
  'activity:watch-anime': (
    animeId: string,
    episodeId?: string,
    fileId?: string
  ) => IpcResult<AnimeWatchResult>
  'activity:stop-anime': (animeId: string) => IpcResult<AnimeStopResult>
  'activity:play-anime-extra': (extraId: string, fileId?: string) => IpcResult<AnimeExtraPlayResult>
  'activity:stop-anime-extra': (extraId: string) => IpcResult<AnimeExtraStopResult>
  'activity:list-anime-watching': () => IpcResult<AnimeWatchingState[]>
  'activity:list-anime-extras-playing': () => IpcResult<AnimeExtraPlayingState[]>
  'activity:read-comic': (
    comicId: string,
    chapterId?: string,
    fileId?: string
  ) => IpcResult<ReadingResult>
  'activity:stop-comic': (comicId: string) => IpcResult<ReadingStopResult>
  'activity:read-novel': (
    novelId: string,
    volumeId?: string,
    fileId?: string
  ) => IpcResult<ReadingResult>
  'activity:stop-novel': (novelId: string) => IpcResult<ReadingStopResult>
  'activity:list-comic-reading': () => IpcResult<ComicReadingState[]>
  'activity:list-novel-reading': () => IpcResult<NovelReadingState[]>

  // Reading marks (called from reader windows only, scoped to the entry the
  // calling window was opened for)
  'activity:list-novel-bookmarks': (novelId: string) => IpcResult<NovelBookmark[]>
  'activity:create-novel-bookmark': (input: NovelBookmarkInput) => IpcResult<NovelBookmark>
  'activity:update-novel-bookmark': (id: string, updates: NovelBookmarkUpdate) => IpcVoidResult
  'activity:delete-novel-bookmark': (id: string) => IpcVoidResult
  'activity:list-novel-highlights': (novelId: string) => IpcResult<NovelHighlight[]>
  'activity:create-novel-highlight': (input: NovelHighlightInput) => IpcResult<NovelHighlight>
  'activity:update-novel-highlight': (id: string, updates: NovelHighlightUpdate) => IpcVoidResult
  'activity:delete-novel-highlight': (id: string) => IpcVoidResult
  'activity:list-comic-bookmarks': (comicId: string) => IpcResult<ComicBookmark[]>
  /** Marking a marked page unmarks it; null is the removal outcome. */
  'activity:toggle-comic-bookmark': (input: ComicBookmarkInput) => IpcResult<ComicBookmark | null>
  'activity:update-comic-bookmark': (id: string, updates: ComicBookmarkUpdate) => IpcVoidResult
  'activity:delete-comic-bookmark': (id: string) => IpcVoidResult

  // Reader window bridge (called from reader windows only)
  'reader:bootstrap': () => IpcResult<ReaderBootstrap>
  'reader:progress': (report: ReaderProgressReport) => IpcVoidResult
  'reader:unit-opened': (report: ReaderUnitOpenedReport) => IpcVoidResult
  /** Authoritative page count of one image-rendered unit file of this window. */
  'reader:probe-pages': (fileId: string) => IpcResult<number>
  'reader:set-page-flow': (report: ReaderPageFlowReport) => IpcVoidResult
  'reader:set-fullscreen': (fullScreen: boolean) => IpcVoidResult
  'reader:close': () => IpcVoidResult

  // Video playback
  'video:list-sessions': () => IpcResult<PlaybackSessionState[]>
  'video:pause': (sessionId: string) => IpcVoidResult
  'video:resume': (sessionId: string) => IpcVoidResult
  'video:seek': (sessionId: string, positionMs: number) => IpcVoidResult
  'video:stop': (sessionId: string) => IpcVoidResult

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

  // Image
  'image:crop-to-temp': (
    input: AttachmentInput,
    cropRegion: CropRegion,
    options?: {
      format?: 'keep' | 'png' | 'jpeg' | 'webp'
      quality?: number
    }
  ) => IpcResult<string>
  /** Downscaled data URL of a not-yet-imported image, for staged form previews. */
  'image:read-preview': (input: AttachmentInput) => IpcResult<string>

  // Attachment workflows
  /** Writes a desktop shortcut that opens the entry's launch deeplink. */
  'attachment:create-launch-shortcut': (
    mediaType: MediaType,
    entityId: string
  ) => IpcResult<{ path: string; iconApplied: boolean }>
  'attachment:create-game-save-backup': (gameId: string, note?: string) => IpcResult<SaveBackup>
  'attachment:delete-game-save-backup': (gameId: string, backupAt: number) => IpcVoidResult
  'attachment:restore-game-save-backup': (gameId: string, backupAt: number) => IpcVoidResult
  'attachment:update-game-save-backup': (
    gameId: string,
    backupAt: number,
    updates: Partial<Pick<SaveBackup, 'note' | 'locked'>>
  ) => IpcVoidResult
  'attachment:open-save-backup-folder': (gameId: string) => IpcVoidResult
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
  'extension:get-development-stale': () => IpcResult<ExtensionDevelopmentStaleState>
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
  'extension:open-webview-page': (
    request: ExtensionWebviewOpenPageRequest
  ) => IpcResult<ExtensionWebviewSessionInfo>
  'extension:post-webview-message': (request: ExtensionWebviewPostMessageRequest) => IpcVoidResult
  'extension:notify-webview-ready': (request: ExtensionWebviewReadyRequest) => IpcVoidResult
  'extension:close-webview': (request: ExtensionWebviewCloseRequest) => IpcVoidResult
  'extension:get-theme-contributions': () => IpcResult<readonly ExtensionThemeRegistrationInfo[]>

  // Scanner
  'scanner:start-scan': (scannerId: string) => IpcResult<ScannerRunStartResult>
  'scanner:start-all-scans': () => IpcResult<ScannerRunStartResult[]>
  'scanner:list-run-states': () => IpcResult<ScannerRunState[]>
  'scanner:pause-scan': (scannerId: string) => IpcResult<boolean>
  'scanner:resume-scan': (scannerId: string) => IpcResult<boolean>
  'scanner:cancel-scan': (scannerId: string) => IpcResult<boolean>
  'scanner:test-extraction-rules': (
    scannerPath: string,
    entityDepth: number,
    rules: NameExtractionRule[]
  ) => IpcResult<ExtractionTestResult[]>

  // Media files
  'holdings:sync-anime': (params: AnimeFileSyncParams) => IpcResult<AnimeFileSyncResult>
  'holdings:attach-anime-episode-file': (params: AnimeEpisodeFileAttachParams) => IpcVoidResult
  'holdings:attach-anime-extra-file': (params: AnimeExtraFileAttachParams) => IpcVoidResult
  'holdings:sync-comic': (params: ComicFileSyncParams) => IpcResult<ComicFileSyncResult>
  'holdings:attach-comic-chapter-file': (params: ComicChapterFileAttachParams) => IpcVoidResult
  'holdings:sync-novel': (params: NovelFileSyncParams) => IpcResult<NovelFileSyncResult>
  'holdings:attach-novel-volume-file': (params: NovelVolumeFileAttachParams) => IpcVoidResult
}

/**
 * IPC events sent from main to renderer.
 *
 * This interface is exported and can be extended via declaration merging.
 * Each event maps to a tuple of its argument types.
 */
export interface IpcRendererEvents {
  ready: [boolean]
  'native:main-window-maximized': []
  'native:main-window-unmaximized': []
  'activity:game-started': [event: GameActivityEvent]
  'activity:game-stopped': [event: GameActivityEvent]
  'activity:game-foreground': [event: GameActivityEvent]
  'activity:game-background': [event: GameActivityEvent]
  'activity:anime-started': [state: AnimeWatchingState]
  'activity:anime-stopped': [state: AnimeWatchingState]
  'activity:anime-extra-started': [state: AnimeExtraPlayingState]
  'activity:anime-extra-stopped': [state: AnimeExtraPlayingState]
  'activity:comic-started': [state: ComicReadingState]
  'activity:comic-unit-changed': [state: ComicReadingState]
  'activity:comic-stopped': [state: ComicReadingState]
  'activity:novel-started': [state: NovelReadingState]
  'activity:novel-unit-changed': [state: NovelReadingState]
  'activity:novel-stopped': [state: NovelReadingState]
  'video:session-started': [state: PlaybackSessionState]
  'video:session-changed': [state: PlaybackSessionState]
  'video:session-progress': [progress: PlaybackProgress]
  'video:session-ended': [report: PlaybackEndReport]
  'scanner:run-state-changed': [state: ScannerRunState]

  // Reader window push: a read request for an entry already open re-aims the
  // existing window instead of opening a second one.
  'reader:navigate': [bootstrap: ReaderBootstrap]
  /** Real window state, so the reader never guesses whether it is full screen. */
  'reader:fullscreen-changed': [fullScreen: boolean]

  // Db change feed (main -> renderer, batched)
  'db:changed': [changes: DbChangeSummary[]]
  'library:entity-merged': [event: LibraryEntityMergedEvent]

  // I18n state push
  'i18n:state-changed': [state: UiLocaleState]

  // Interface scale push (every window mirrors the main-owned value)
  'window:interface-scale-changed': [scale: UiScale]

  // Automation state pushes
  'automation:changed': [payload: { automationId: string }]
  'automation:deleted': [payload: { automationId: string }]
  'automation:run-started': [event: AutomationRunStartedEvent]
  'automation:run-finished': [record: AutomationRunHistoryRecord]

  'updater:state-changed': [state: AppUpdaterState]
  'task-run:changed': [run: TaskRun]
  'task-run:deleted': [payload: { runId: string }]

  'notification:show': [NotifyOptions & { toastId?: string }]
  'notification:loading': [{ toastId: string; title: string; message?: string }]
  'notification:update': [{ toastId: string } & NotifyOptions]
  'notification:dismiss': [{ toastId?: string }]

  // Extension contribution refresh (main -> renderer)
  'extension:repositories-changed': []
  'extension:catalog-changed': []
  'extension:installations-changed': []
  'extension:runtime-state-changed': [event: ExtensionRuntimeStateChangedEvent]
  'extension:development-stale-changed': [state: ExtensionDevelopmentStaleState]
  'extension:automatic-update-run-changed': [state: ExtensionAutomaticUpdateRunState]
  'extension:trusted-signers-changed': []
  'extension:contributions-changed': [snapshot: ExtensionContributionSnapshot]
  'extension:entity-menus-refresh-requested': [event: ExtensionEntityMenuRefreshRequestedEvent]
  'extension:webview-sessions-changed': [sessions: readonly ExtensionWebviewSessionInfo[]]
  'extension:webview-message': [event: ExtensionWebviewMessageEvent]

  // Deeplink events (main → renderer)
  'deeplink:open': [DeeplinkOpenPayload]
}
