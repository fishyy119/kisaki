import type { HostEventTopic, HostEvents } from '../capabilities/events'
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
import type { SerializableValue } from '../shared'
import { RPC_ABORT_EVENT, type RpcMethodDefinition, type RpcNoPayload, type RpcValue } from './core'
import type { ExtensionScopedRpcParams } from './lifecycle'

export interface ExtensionLogRequest extends ExtensionScopedRpcParams {
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  args: readonly RpcValue[]
}

export interface StorageGetRequest extends ExtensionScopedRpcParams {
  key: string
  fallback: SerializableValue
}

export interface StorageGetResult {
  value: SerializableValue
}

export interface StorageSetRequest extends ExtensionScopedRpcParams {
  key: string
  value: SerializableValue
}

export interface StorageDeleteRequest extends ExtensionScopedRpcParams {
  key: string
}

export interface StorageListKeysRequest extends ExtensionScopedRpcParams {
  prefix?: string
}

export interface StorageListKeysResult {
  keys: readonly string[]
}

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
  'bridge.logger.log': RpcMethodDefinition<ExtensionLogRequest, RpcNoPayload>
  'bridge.storage.get': RpcMethodDefinition<StorageGetRequest, StorageGetResult>
  'bridge.storage.set': RpcMethodDefinition<StorageSetRequest, RpcNoPayload>
  'bridge.storage.delete': RpcMethodDefinition<StorageDeleteRequest, RpcNoPayload>
  'bridge.storage.listKeys': RpcMethodDefinition<StorageListKeysRequest, StorageListKeysResult>
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
  [RPC_ABORT_EVENT]: { requestId: string }
  'capabilities.events.host': HostEventNotification
}
