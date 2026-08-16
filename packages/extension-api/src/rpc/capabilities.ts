import type { ExtensionFileGrant, GetFileIconInput, PickFileInput } from '../capabilities/files'
import type {
  Automation,
  AutomationCreateInput,
  AutomationRunHistoryRecord,
  AutomationUpdateInput
} from '../capabilities/automations'
import type {
  CommandDescriptor,
  CommandInvocationResult,
  CommandListItem,
  CommandInvocationRequest
} from '../capabilities/commands'
import type {
  IngestAddAnimeFromScraperOptions,
  IngestAddAnimeFromScraperResult,
  IngestAddGameFromScraperOptions,
  IngestAddGameFromScraperResult,
  IngestAddMovieFromScraperOptions,
  IngestAddMovieFromScraperResult,
  IngestAddTvFromScraperOptions,
  IngestAddTvFromScraperResult,
  IngestGameUpdateFromScraperInput,
  IngestTaskRunStart,
  IngestUpdateResult
} from '../capabilities/ingest'
import type {
  LibraryAnime,
  LibraryAnimeCreateInput,
  LibraryAnimeEpisode,
  LibraryAnimeEpisodeQuery,
  LibraryAnimeEpisodeWatchStatePatch,
  LibraryAnimePatch,
  LibraryAnimeQuery,
  LibraryAttachment,
  LibraryAttachmentRemoveInput,
  LibraryAttachmentWriteInput,
  LibraryCharacter,
  LibraryCharacterCreateInput,
  LibraryCharacterPatch,
  LibraryCharacterQuery,
  LibraryCollection,
  LibraryCollectionCreateInput,
  LibraryCollectionPatch,
  LibraryCollectionQuery,
  LibraryCompany,
  LibraryCompanyCreateInput,
  LibraryCompanyPatch,
  LibraryCompanyQuery,
  LibraryGame,
  LibraryGameCreateInput,
  LibraryGamePatch,
  LibraryGameQuery,
  LibraryGraphInput,
  LibraryGraphResult,
  LibraryLink,
  LibraryLinkCreateInput,
  LibraryLinkPatch,
  LibraryLinkQuery,
  LibraryLinkSelector,
  LibraryMediaRelation,
  LibraryMediaRelationCreateInput,
  LibraryMediaRelationPatch,
  LibraryMediaRelationQuery,
  LibraryMediaRelationSelector,
  LibraryMovie,
  LibraryMovieCreateInput,
  LibraryMoviePatch,
  LibraryMovieQuery,
  LibraryPerson,
  LibraryPersonCreateInput,
  LibraryPersonPatch,
  LibraryPersonQuery,
  LibraryTag,
  LibraryTagCreateInput,
  LibraryTagPatch,
  LibraryTagQuery,
  LibraryTv,
  LibraryTvCreateInput,
  LibraryTvEpisode,
  LibraryTvEpisodeQuery,
  LibraryTvEpisodeWatchStatePatch,
  LibraryTvPatch,
  LibraryTvQuery,
  LibraryTvSeason,
  LibraryTvSeasonQuery
} from '../capabilities/library'
import type {
  NetworkDownloadRequest,
  NetworkDownloadResult,
  NetworkRequest,
  NetworkResponse
} from '../capabilities/network'
import type { NotificationHandle, NotificationKind, NotifyOptions } from '../capabilities/notify'
import type { RuntimeInfo } from '../capabilities/runtime'
import type { ScraperProfileListQuery, ScraperProfileSummary } from '../capabilities/scrapers'
import type {
  TaskRunActiveListQuery,
  TaskRunCreateInput,
  TaskRunHistoryListQuery,
  TaskRunProgressUpdate,
  TaskRunResult,
  TaskRunSnapshot
} from '../capabilities/task-runs'
import type { WebviewOpenOptions } from '../capabilities/webviews'
import type {
  AnimeScraperLookup,
  GameScraperLookup,
  MovieScraperLookup,
  TvScraperLookup
} from '../contributions/scraper-providers'
import type { JsonObject, JsonValue } from '../shared'
import type { RpcMethodDefinition, RpcNoPayload, RpcValue } from './core'
import type { ExtensionScopedRpcParams } from './lifecycle'

export interface NotifyShowRequest extends ExtensionScopedRpcParams {
  kind: NotificationKind
  title: string
  options?: string | NotifyOptions
}

export interface NotifyUpdateRequest extends ExtensionScopedRpcParams {
  id: string
  kind: NotificationKind
  title: string
  options?: string | NotifyOptions
}

export interface NotifyDismissRequest extends ExtensionScopedRpcParams {
  id: string
}

export type RuntimeInfoRequest = ExtensionScopedRpcParams

export interface RuntimeOpenExternalRequest extends ExtensionScopedRpcParams {
  url: string
}

export interface PickFileRequest extends ExtensionScopedRpcParams {
  input?: PickFileInput
}

export interface ReleaseFileGrantRequest extends ExtensionScopedRpcParams {
  grantId: string
}

export interface GetFileIconRequest extends ExtensionScopedRpcParams {
  path: string
  input?: GetFileIconInput
}

export interface CommandGetRequest extends ExtensionScopedRpcParams {
  commandId: string
}

export interface CommandInvocationRpcRequest extends ExtensionScopedRpcParams {
  request: CommandInvocationRequest
}

export interface ScraperProfilesListRequest extends ExtensionScopedRpcParams {
  query?: ScraperProfileListQuery
}

export interface ScraperProfileGetRequest extends ExtensionScopedRpcParams {
  profileId: string
}

export interface IngestGameAddFromScraperRequest extends ExtensionScopedRpcParams {
  profileId: string
  lookup: GameScraperLookup
  options?: IngestAddGameFromScraperOptions
}

export interface IngestGameUpdateFromScraperRequest extends ExtensionScopedRpcParams {
  input: IngestGameUpdateFromScraperInput
}

export interface IngestAnimeAddFromScraperRequest extends ExtensionScopedRpcParams {
  profileId: string
  lookup: AnimeScraperLookup
  options?: IngestAddAnimeFromScraperOptions
}

export interface IngestTvAddFromScraperRequest extends ExtensionScopedRpcParams {
  profileId: string
  lookup: TvScraperLookup
  options?: IngestAddTvFromScraperOptions
}

export interface IngestMovieAddFromScraperRequest extends ExtensionScopedRpcParams {
  profileId: string
  lookup: MovieScraperLookup
  options?: IngestAddMovieFromScraperOptions
}

export interface LibraryGraphRpcRequest extends ExtensionScopedRpcParams {
  input: LibraryGraphInput
}

export interface AutomationCreateRequest extends ExtensionScopedRpcParams {
  input: AutomationCreateInput
}

export interface AutomationGetRequest extends ExtensionScopedRpcParams {
  automationId: string
}

export interface AutomationUpdateRequest extends ExtensionScopedRpcParams {
  automationId: string
  patch: AutomationUpdateInput
}

export interface AutomationSetEnabledRequest extends ExtensionScopedRpcParams {
  automationId: string
  enabled: boolean
}

export interface AutomationDeleteRequest extends ExtensionScopedRpcParams {
  automationId: string
}

export interface AutomationRunRequest extends ExtensionScopedRpcParams {
  automationId: string
}

export interface TaskRunFailureErrorPayload {
  message: string
  code?: string
}

export interface TaskRunCreateRequest extends ExtensionScopedRpcParams {
  input: TaskRunCreateInput
}

export interface TaskRunScopedRequest extends ExtensionScopedRpcParams {
  runId: string
}

export interface TaskRunReportRequest extends TaskRunScopedRequest {
  update: TaskRunProgressUpdate
}

export interface TaskRunCompleteRequest extends TaskRunScopedRequest {
  result?: Omit<TaskRunResult, 'status' | 'error'>
}

export interface TaskRunFailRequest extends TaskRunScopedRequest {
  error: TaskRunFailureErrorPayload
  result?: Omit<TaskRunResult, 'status' | 'error'>
}

export interface TaskRunCancelRequest extends TaskRunScopedRequest {
  result?: Omit<TaskRunResult, 'status' | 'error'>
}

export interface TaskRunActiveListRequest extends ExtensionScopedRpcParams {
  query?: TaskRunActiveListQuery
}

export interface TaskRunHistoryListRequest extends ExtensionScopedRpcParams {
  query?: TaskRunHistoryListQuery
}

export interface TaskRunCancelRequestedEvent {
  runtimeHandle: string
  runId: string
}

export interface WebviewOpenPageRpcRequest extends ExtensionScopedRpcParams {
  pageId: string
  options?: WebviewOpenOptions
}

export interface WebviewOpenDialogRpcRequest extends ExtensionScopedRpcParams {
  dialogId: string
  options?: WebviewOpenOptions
}

export interface WebviewScopedRpcRequest extends ExtensionScopedRpcParams {
  webviewId: string
}

export interface WebviewPostMessageRpcRequest extends WebviewScopedRpcRequest {
  message: JsonValue
}

/**
 * Declared surface a webview session belongs to, as delivered with the
 * {@link WebviewOpenedEvent} so the host can route the session to the owning
 * page or dialog registration.
 */
export type WebviewOpenedSurface =
  { kind: 'page'; pageId: string } | { kind: 'dialog'; dialogId: string }

export interface WebviewOpenedEvent {
  runtimeHandle: string
  webviewId: string
  surface: WebviewOpenedSurface
  params: JsonObject
}

export interface WebviewMessagePostedEvent {
  runtimeHandle: string
  webviewId: string
  message: JsonValue
}

export interface WebviewClosedEvent {
  runtimeHandle: string
  webviewId: string
}

export type LibraryEntityRpcRequestMap<TPrefix extends string, TEntity, TCreate, TPatch, TQuery> = {
  [K in `${TPrefix}.get`]: RpcMethodDefinition<
    ExtensionScopedRpcParams & { id: string },
    { entity: TEntity | null }
  >
} & {
  [K in `${TPrefix}.list`]: RpcMethodDefinition<
    ExtensionScopedRpcParams & { query?: TQuery },
    { items: readonly TEntity[] }
  >
} & {
  [K in `${TPrefix}.create`]: RpcMethodDefinition<
    ExtensionScopedRpcParams & { input: TCreate },
    { entity: TEntity }
  >
} & {
  [K in `${TPrefix}.update`]: RpcMethodDefinition<
    ExtensionScopedRpcParams & { id: string; patch: TPatch },
    { entity: TEntity }
  >
} & {
  [K in `${TPrefix}.remove`]: RpcMethodDefinition<
    ExtensionScopedRpcParams & { id: string },
    RpcNoPayload
  >
}

export type HostToMainCapabilityRpcRequestMap = {
  'capabilities.files.pickFile': RpcMethodDefinition<
    PickFileRequest,
    { grant: ExtensionFileGrant | null }
  >
  'capabilities.files.releaseGrant': RpcMethodDefinition<ReleaseFileGrantRequest, RpcNoPayload>
  'capabilities.files.getFileIcon': RpcMethodDefinition<
    GetFileIconRequest,
    { icon: Uint8Array | null }
  >
  'capabilities.library.graph.preview': RpcMethodDefinition<
    LibraryGraphRpcRequest,
    { result: LibraryGraphResult }
  >
  'capabilities.library.graph.apply': RpcMethodDefinition<
    LibraryGraphRpcRequest,
    { result: LibraryGraphResult }
  >
  'capabilities.library.links.list': RpcMethodDefinition<
    ExtensionScopedRpcParams & { query?: LibraryLinkQuery },
    { items: readonly LibraryLink[] }
  >
  'capabilities.library.links.create': RpcMethodDefinition<
    ExtensionScopedRpcParams & { input: LibraryLinkCreateInput },
    { link: LibraryLink }
  >
  'capabilities.library.links.update': RpcMethodDefinition<
    ExtensionScopedRpcParams & { selector: LibraryLinkSelector; patch: LibraryLinkPatch },
    { link: LibraryLink }
  >
  'capabilities.library.links.remove': RpcMethodDefinition<
    ExtensionScopedRpcParams & { selector: LibraryLinkSelector },
    RpcNoPayload
  >
  'capabilities.library.relations.list': RpcMethodDefinition<
    ExtensionScopedRpcParams & { query?: LibraryMediaRelationQuery },
    { items: readonly LibraryMediaRelation[] }
  >
  'capabilities.library.relations.create': RpcMethodDefinition<
    ExtensionScopedRpcParams & { input: LibraryMediaRelationCreateInput },
    { relation: LibraryMediaRelation }
  >
  'capabilities.library.relations.update': RpcMethodDefinition<
    ExtensionScopedRpcParams & {
      selector: LibraryMediaRelationSelector
      patch: LibraryMediaRelationPatch
    },
    { relation: LibraryMediaRelation }
  >
  'capabilities.library.relations.remove': RpcMethodDefinition<
    ExtensionScopedRpcParams & { selector: LibraryMediaRelationSelector },
    RpcNoPayload
  >
  'capabilities.library.animes.episodes.list': RpcMethodDefinition<
    ExtensionScopedRpcParams & { query: LibraryAnimeEpisodeQuery },
    { items: readonly LibraryAnimeEpisode[] }
  >
  'capabilities.library.animes.episodes.patchWatchState': RpcMethodDefinition<
    ExtensionScopedRpcParams & { episodeId: string; patch: LibraryAnimeEpisodeWatchStatePatch },
    { episode: LibraryAnimeEpisode }
  >
  'capabilities.library.tvs.seasons.list': RpcMethodDefinition<
    ExtensionScopedRpcParams & { query: LibraryTvSeasonQuery },
    { items: readonly LibraryTvSeason[] }
  >
  'capabilities.library.tvs.episodes.list': RpcMethodDefinition<
    ExtensionScopedRpcParams & { query: LibraryTvEpisodeQuery },
    { items: readonly LibraryTvEpisode[] }
  >
  'capabilities.library.tvs.episodes.patchWatchState': RpcMethodDefinition<
    ExtensionScopedRpcParams & { episodeId: string; patch: LibraryTvEpisodeWatchStatePatch },
    { episode: LibraryTvEpisode }
  >
  'capabilities.library.attachments.list': RpcMethodDefinition<
    ExtensionScopedRpcParams & { entity: LibraryAttachment['entity'] },
    { items: readonly LibraryAttachment[] }
  >
  'capabilities.library.attachments.put': RpcMethodDefinition<
    ExtensionScopedRpcParams & { input: LibraryAttachmentWriteInput },
    { attachment: LibraryAttachment }
  >
  'capabilities.library.attachments.remove': RpcMethodDefinition<
    ExtensionScopedRpcParams & { input: LibraryAttachmentRemoveInput },
    RpcNoPayload
  >
  'capabilities.network.request': RpcMethodDefinition<
    ExtensionScopedRpcParams & { input: NetworkRequest },
    { response: NetworkResponse<RpcValue> }
  >
  'capabilities.network.download': RpcMethodDefinition<
    ExtensionScopedRpcParams & { input: NetworkDownloadRequest },
    { result: NetworkDownloadResult }
  >
  'capabilities.notify.show': RpcMethodDefinition<NotifyShowRequest, { handle: NotificationHandle }>
  'capabilities.notify.update': RpcMethodDefinition<NotifyUpdateRequest, RpcNoPayload>
  'capabilities.notify.dismiss': RpcMethodDefinition<NotifyDismissRequest, RpcNoPayload>
  'capabilities.runtime.getInfo': RpcMethodDefinition<RuntimeInfoRequest, { info: RuntimeInfo }>
  'capabilities.runtime.openExternal': RpcMethodDefinition<RuntimeOpenExternalRequest, RpcNoPayload>
  'capabilities.scrapers.profiles.list': RpcMethodDefinition<
    ScraperProfilesListRequest,
    { items: readonly ScraperProfileSummary[] }
  >
  'capabilities.scrapers.profiles.get': RpcMethodDefinition<
    ScraperProfileGetRequest,
    { profile: ScraperProfileSummary | null }
  >
  'capabilities.ingest.game.add.fromScraper': RpcMethodDefinition<
    IngestGameAddFromScraperRequest,
    { result: IngestAddGameFromScraperResult }
  >
  'capabilities.ingest.game.add.startFromScraper': RpcMethodDefinition<
    IngestGameAddFromScraperRequest,
    { start: IngestTaskRunStart }
  >
  'capabilities.ingest.game.update.fromScraper': RpcMethodDefinition<
    IngestGameUpdateFromScraperRequest,
    { result: IngestUpdateResult }
  >
  'capabilities.ingest.game.update.startFromScraper': RpcMethodDefinition<
    IngestGameUpdateFromScraperRequest,
    { start: IngestTaskRunStart }
  >
  'capabilities.ingest.anime.add.fromScraper': RpcMethodDefinition<
    IngestAnimeAddFromScraperRequest,
    { result: IngestAddAnimeFromScraperResult }
  >
  'capabilities.ingest.anime.add.startFromScraper': RpcMethodDefinition<
    IngestAnimeAddFromScraperRequest,
    { start: IngestTaskRunStart }
  >
  'capabilities.ingest.tv.add.fromScraper': RpcMethodDefinition<
    IngestTvAddFromScraperRequest,
    { result: IngestAddTvFromScraperResult }
  >
  'capabilities.ingest.tv.add.startFromScraper': RpcMethodDefinition<
    IngestTvAddFromScraperRequest,
    { start: IngestTaskRunStart }
  >
  'capabilities.ingest.movie.add.fromScraper': RpcMethodDefinition<
    IngestMovieAddFromScraperRequest,
    { result: IngestAddMovieFromScraperResult }
  >
  'capabilities.ingest.movie.add.startFromScraper': RpcMethodDefinition<
    IngestMovieAddFromScraperRequest,
    { start: IngestTaskRunStart }
  >
  'capabilities.commands.list': RpcMethodDefinition<
    ExtensionScopedRpcParams,
    { items: readonly CommandListItem[] }
  >
  'capabilities.commands.get': RpcMethodDefinition<
    CommandGetRequest,
    { command: CommandDescriptor | null }
  >
  'capabilities.commands.invoke': RpcMethodDefinition<
    CommandInvocationRpcRequest,
    { result: CommandInvocationResult }
  >
  'capabilities.automations.list': RpcMethodDefinition<
    ExtensionScopedRpcParams,
    { items: readonly Automation[] }
  >
  'capabilities.automations.get': RpcMethodDefinition<
    AutomationGetRequest,
    { automation: Automation | null }
  >
  'capabilities.automations.create': RpcMethodDefinition<
    AutomationCreateRequest,
    { automation: Automation }
  >
  'capabilities.automations.update': RpcMethodDefinition<
    AutomationUpdateRequest,
    { automation: Automation }
  >
  'capabilities.automations.setEnabled': RpcMethodDefinition<
    AutomationSetEnabledRequest,
    { automation: Automation }
  >
  'capabilities.automations.delete': RpcMethodDefinition<AutomationDeleteRequest, RpcNoPayload>
  'capabilities.automations.run': RpcMethodDefinition<
    AutomationRunRequest,
    { record: AutomationRunHistoryRecord | null }
  >
  'capabilities.taskRuns.create': RpcMethodDefinition<
    TaskRunCreateRequest,
    { run: TaskRunSnapshot }
  >
  'capabilities.taskRuns.report': RpcMethodDefinition<TaskRunReportRequest, RpcNoPayload>
  'capabilities.taskRuns.checkpoint': RpcMethodDefinition<TaskRunScopedRequest, RpcNoPayload>
  'capabilities.taskRuns.complete': RpcMethodDefinition<TaskRunCompleteRequest, RpcNoPayload>
  'capabilities.taskRuns.fail': RpcMethodDefinition<TaskRunFailRequest, RpcNoPayload>
  'capabilities.taskRuns.cancel': RpcMethodDefinition<TaskRunCancelRequest, RpcNoPayload>
  'capabilities.taskRuns.listActiveOwn': RpcMethodDefinition<
    TaskRunActiveListRequest,
    { items: readonly TaskRunSnapshot[] }
  >
  'capabilities.taskRuns.listHistoryOwn': RpcMethodDefinition<
    TaskRunHistoryListRequest,
    { items: readonly TaskRunSnapshot[] }
  >
  'capabilities.taskRuns.getActiveOwn': RpcMethodDefinition<
    TaskRunScopedRequest,
    { run: TaskRunSnapshot | null }
  >
  'capabilities.taskRuns.getHistoryOwn': RpcMethodDefinition<
    TaskRunScopedRequest,
    { run: TaskRunSnapshot | null }
  >
  'capabilities.taskRuns.cancelOwn': RpcMethodDefinition<
    TaskRunScopedRequest,
    { cancelled: boolean }
  >
  'capabilities.taskRuns.waitOwn': RpcMethodDefinition<
    TaskRunScopedRequest,
    { run: TaskRunSnapshot }
  >
  'capabilities.webviews.openPage': RpcMethodDefinition<
    WebviewOpenPageRpcRequest,
    { webviewId: string }
  >
  'capabilities.webviews.openDialog': RpcMethodDefinition<
    WebviewOpenDialogRpcRequest,
    { webviewId: string }
  >
  'capabilities.webviews.close': RpcMethodDefinition<WebviewScopedRpcRequest, RpcNoPayload>
  'capabilities.webviews.postMessage': RpcMethodDefinition<
    WebviewPostMessageRpcRequest,
    RpcNoPayload
  >
} & LibraryEntityRpcRequestMap<
  'capabilities.library.games',
  LibraryGame,
  LibraryGameCreateInput,
  LibraryGamePatch,
  LibraryGameQuery
> &
  LibraryEntityRpcRequestMap<
    'capabilities.library.animes',
    LibraryAnime,
    LibraryAnimeCreateInput,
    LibraryAnimePatch,
    LibraryAnimeQuery
  > &
  LibraryEntityRpcRequestMap<
    'capabilities.library.tvs',
    LibraryTv,
    LibraryTvCreateInput,
    LibraryTvPatch,
    LibraryTvQuery
  > &
  LibraryEntityRpcRequestMap<
    'capabilities.library.movies',
    LibraryMovie,
    LibraryMovieCreateInput,
    LibraryMoviePatch,
    LibraryMovieQuery
  > &
  LibraryEntityRpcRequestMap<
    'capabilities.library.characters',
    LibraryCharacter,
    LibraryCharacterCreateInput,
    LibraryCharacterPatch,
    LibraryCharacterQuery
  > &
  LibraryEntityRpcRequestMap<
    'capabilities.library.persons',
    LibraryPerson,
    LibraryPersonCreateInput,
    LibraryPersonPatch,
    LibraryPersonQuery
  > &
  LibraryEntityRpcRequestMap<
    'capabilities.library.companies',
    LibraryCompany,
    LibraryCompanyCreateInput,
    LibraryCompanyPatch,
    LibraryCompanyQuery
  > &
  LibraryEntityRpcRequestMap<
    'capabilities.library.collections',
    LibraryCollection,
    LibraryCollectionCreateInput,
    LibraryCollectionPatch,
    LibraryCollectionQuery
  > &
  LibraryEntityRpcRequestMap<
    'capabilities.library.tags',
    LibraryTag,
    LibraryTagCreateInput,
    LibraryTagPatch,
    LibraryTagQuery
  >

export interface MainToHostCapabilityRpcEventMap {
  'capabilities.taskRuns.cancelRequested': TaskRunCancelRequestedEvent
  'capabilities.webviews.opened': WebviewOpenedEvent
  'capabilities.webviews.messagePosted': WebviewMessagePostedEvent
  'capabilities.webviews.closed': WebviewClosedEvent
}
