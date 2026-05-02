import type { HostEventTopic, HostEvents } from '../capabilities/events'
import type {
  BackgroundTask,
  BackgroundTaskCreateInput,
  BackgroundTaskRunRecord,
  BackgroundTaskUpdateInput
} from '../capabilities/background-tasks'
import type {
  CommandDescriptor,
  CommandExecutionResult,
  CommandExecutionStartResult,
  CommandListItem,
  CommandExecutionRequest
} from '../capabilities/commands'
import type {
  IngestAddGameFromScraperOptions,
  IngestAddGameFromScraperResult
} from '../capabilities/ingest'
import type {
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
  LibraryPerson,
  LibraryPersonCreateInput,
  LibraryPersonPatch,
  LibraryPersonQuery,
  LibraryRelation,
  LibraryRelationCreateInput,
  LibraryRelationPatch,
  LibraryRelationQuery,
  LibraryRelationSelector,
  LibraryTag,
  LibraryTagCreateInput,
  LibraryTagPatch,
  LibraryTagQuery
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
import type { ScraperLookup } from '../contributions/scrapers'
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

export interface HostEventSubscriptionRequest extends ExtensionScopedRpcParams {
  subscriptionId: string
  topic: HostEventTopic
}

export interface HostEventNotification {
  subscriptionId: string
  topic: HostEventTopic
  payload: HostEvents[HostEventTopic]
}

export interface CommandGetRequest extends ExtensionScopedRpcParams {
  commandId: string
}

export interface CommandExecutionRpcRequest extends ExtensionScopedRpcParams {
  request: CommandExecutionRequest
}

export interface CommandWaitRequest extends ExtensionScopedRpcParams {
  executionId: string
}

export interface CommandCancelRequest extends ExtensionScopedRpcParams {
  executionId: string
}

export interface ScraperProfilesListRequest extends ExtensionScopedRpcParams {
  query?: ScraperProfileListQuery
}

export interface ScraperProfileGetRequest extends ExtensionScopedRpcParams {
  profileId: string
}

export interface IngestGameAddFromScraperRequest extends ExtensionScopedRpcParams {
  profileId: string
  lookup: ScraperLookup
  options?: IngestAddGameFromScraperOptions
}

export interface BackgroundTaskCreateRequest extends ExtensionScopedRpcParams {
  input: BackgroundTaskCreateInput
}

export interface BackgroundTaskGetRequest extends ExtensionScopedRpcParams {
  taskId: string
}

export interface BackgroundTaskUpdateRequest extends ExtensionScopedRpcParams {
  taskId: string
  patch: BackgroundTaskUpdateInput
}

export interface BackgroundTaskSetEnabledRequest extends ExtensionScopedRpcParams {
  taskId: string
  enabled: boolean
}

export interface BackgroundTaskDeleteRequest extends ExtensionScopedRpcParams {
  taskId: string
}

export interface BackgroundTaskRunRequest extends ExtensionScopedRpcParams {
  taskId: string
}

export interface BackgroundTaskCancelRequest extends ExtensionScopedRpcParams {
  taskId: string
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
  'capabilities.library.relations.list': RpcMethodDefinition<
    ExtensionScopedRpcParams & { query?: LibraryRelationQuery },
    { items: readonly LibraryRelation[] }
  >
  'capabilities.library.relations.create': RpcMethodDefinition<
    ExtensionScopedRpcParams & { input: LibraryRelationCreateInput },
    { relation: LibraryRelation }
  >
  'capabilities.library.relations.update': RpcMethodDefinition<
    ExtensionScopedRpcParams & { selector: LibraryRelationSelector; patch: LibraryRelationPatch },
    { relation: LibraryRelation }
  >
  'capabilities.library.relations.remove': RpcMethodDefinition<
    ExtensionScopedRpcParams & { selector: LibraryRelationSelector },
    RpcNoPayload
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
  'capabilities.ingest.games.addFromScraper': RpcMethodDefinition<
    IngestGameAddFromScraperRequest,
    { result: IngestAddGameFromScraperResult }
  >
  'capabilities.commands.list': RpcMethodDefinition<
    ExtensionScopedRpcParams,
    { items: readonly CommandListItem[] }
  >
  'capabilities.commands.get': RpcMethodDefinition<
    CommandGetRequest,
    { command: CommandDescriptor | null }
  >
  'capabilities.commands.start': RpcMethodDefinition<
    CommandExecutionRpcRequest,
    { result: CommandExecutionStartResult }
  >
  'capabilities.commands.wait': RpcMethodDefinition<
    CommandWaitRequest,
    { result: CommandExecutionResult }
  >
  'capabilities.commands.execute': RpcMethodDefinition<
    CommandExecutionRpcRequest,
    { result: CommandExecutionResult }
  >
  'capabilities.commands.cancel': RpcMethodDefinition<CommandCancelRequest, { cancelled: boolean }>
  'capabilities.backgroundTasks.list': RpcMethodDefinition<
    ExtensionScopedRpcParams,
    { items: readonly BackgroundTask[] }
  >
  'capabilities.backgroundTasks.get': RpcMethodDefinition<
    BackgroundTaskGetRequest,
    { task: BackgroundTask | null }
  >
  'capabilities.backgroundTasks.create': RpcMethodDefinition<
    BackgroundTaskCreateRequest,
    { task: BackgroundTask }
  >
  'capabilities.backgroundTasks.update': RpcMethodDefinition<
    BackgroundTaskUpdateRequest,
    { task: BackgroundTask }
  >
  'capabilities.backgroundTasks.setEnabled': RpcMethodDefinition<
    BackgroundTaskSetEnabledRequest,
    { task: BackgroundTask }
  >
  'capabilities.backgroundTasks.delete': RpcMethodDefinition<
    BackgroundTaskDeleteRequest,
    RpcNoPayload
  >
  'capabilities.backgroundTasks.run': RpcMethodDefinition<
    BackgroundTaskRunRequest,
    { record: BackgroundTaskRunRecord }
  >
  'capabilities.backgroundTasks.cancel': RpcMethodDefinition<
    BackgroundTaskCancelRequest,
    { cancelled: boolean }
  >
  'capabilities.events.subscribeHost': RpcMethodDefinition<
    HostEventSubscriptionRequest,
    RpcNoPayload
  >
  'capabilities.events.unsubscribeHost': RpcMethodDefinition<
    HostEventSubscriptionRequest,
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
  'capabilities.events.host': HostEventNotification
}
