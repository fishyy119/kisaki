import type { HostEventTopic, HostEvents } from './capabilities/events'
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
} from './capabilities/library'
import type {
  NetworkDownloadRequest,
  NetworkDownloadResult,
  NetworkRequest,
  NetworkResponse
} from './capabilities/network'
import type { NotificationHandle, NotificationKind, NotifyOptions } from './capabilities/notify'
import type { RuntimeInfo } from './capabilities/runtime'
import type { ExtensionRuntimeMetadata } from './context'
import type { DeeplinkRequest, DeeplinkResponse } from './contributions/deeplinks'
import type {
  EntityMenuItem,
  EntityMenuResolveInput,
  EntityMenuTarget
} from './contributions/entity-menus'
import type { SettingsPanelResolvedNode } from './contributions/settings-panels'
import type {
  CharacterScraperSlot,
  CharacterSessionResultMap,
  CharacterSearchResult,
  CompanyScraperSlot,
  CompanySessionResultMap,
  CompanySearchResult,
  GameScraperSlot,
  GameSessionResultMap,
  GameSearchResult,
  IdResolvedTarget,
  PersonScraperSlot,
  PersonSessionResultMap,
  PersonSearchResult,
  ScraperLookup
} from './contributions/scrapers'
import type { ThemeContribution } from './contributions/themes'
import type {
  Locale,
  SerializablePrimitive,
  SerializableRecord,
  SerializableValue,
  UiCallbackResult
} from './shared'

export interface RpcErrorPayload {
  code?: string
  message: string
  details?: SerializableRecord
  stack?: string
}

export type RpcBinary = Uint8Array

export type RpcPrimitive = SerializablePrimitive

export type RpcValue =
  | RpcPrimitive
  | RpcBinary
  | readonly RpcValue[]
  | { readonly [key: string]: RpcValue }

export interface RpcRecord {
  readonly [key: string]: RpcValue
}

export type RpcMethod = string

export type RpcEventTopic = string

export const EXTENSION_RPC_PROTOCOL_VERSION = '1'

export const RPC_HANDSHAKE_METHOD = '$/handshake'

export const RPC_ABORT_EVENT = 'rpc.abort'

export interface RpcHandshakeRequest {
  protocolVersion: string
  peerVersion?: string
  metadata?: SerializableRecord
}

export interface RpcHandshakeResponse {
  protocolVersion: string
  accepted: boolean
  error?: RpcErrorPayload
  metadata?: SerializableRecord
}

export interface RpcRequestMessage<TMethod extends RpcMethod = RpcMethod, TParams = RpcValue> {
  kind: 'request'
  id: string
  method: TMethod
  params: TParams
}

export interface RpcSuccessResponseMessage<TResult = RpcValue> {
  kind: 'response'
  id: string
  ok: true
  result: TResult
}

export interface RpcErrorResponseMessage {
  kind: 'response'
  id: string
  ok: false
  error: RpcErrorPayload
}

export interface RpcEventMessage<TName extends RpcEventTopic = RpcEventTopic, TPayload = RpcValue> {
  kind: 'event'
  name: TName
  payload: TPayload
}

export type RpcResponseMessage<TResult = RpcValue> =
  | RpcSuccessResponseMessage<TResult>
  | RpcErrorResponseMessage

export type RpcMessage<
  TMethod extends RpcMethod = RpcMethod,
  TParams = RpcValue,
  TResult = RpcValue,
  TEventName extends RpcEventTopic = RpcEventTopic,
  TEventPayload = RpcValue
> =
  | RpcRequestMessage<TMethod, TParams>
  | RpcResponseMessage<TResult>
  | RpcEventMessage<TEventName, TEventPayload>

export interface RpcNoPayload {
  readonly [key: string]: never
}

export interface RpcMethodDefinition<TParams = RpcNoPayload, TResult = RpcNoPayload> {
  params: TParams
  result: TResult
}

export type RpcRequestMap = object

export type RpcEventMap = object

export type RpcMethodName<TMap extends RpcRequestMap = RpcRequestMap> = Extract<keyof TMap, string>

export type RpcEventName<TMap extends RpcEventMap = RpcEventMap> = Extract<keyof TMap, string>

export type RpcParams<TMap extends RpcRequestMap, TMethod extends RpcMethodName<TMap>> =
  TMap[TMethod] extends RpcMethodDefinition<infer TParams, unknown> ? TParams : never

export type RpcResult<TMap extends RpcRequestMap, TMethod extends RpcMethodName<TMap>> =
  TMap[TMethod] extends RpcMethodDefinition<unknown, infer TResult> ? TResult : never

export type RpcPayload<TMap extends RpcEventMap, TEvent extends RpcEventName<TMap>> = TMap[TEvent]

export type RpcTypedRequestMessage<
  TMap extends RpcRequestMap,
  TMethod extends RpcMethodName<TMap> = RpcMethodName<TMap>
> = RpcRequestMessage<TMethod, RpcParams<TMap, TMethod>>

export type RpcTypedResponseMessage<
  TMap extends RpcRequestMap,
  TMethod extends RpcMethodName<TMap> = RpcMethodName<TMap>
> = RpcResponseMessage<RpcResult<TMap, TMethod>>

export type RpcTypedEventMessage<
  TMap extends RpcEventMap,
  TEvent extends RpcEventName<TMap> = RpcEventName<TMap>
> = RpcEventMessage<TEvent, RpcPayload<TMap, TEvent>>

export type ExtensionUnloadReason = 'shutdown' | 'disable' | 'reload' | 'update'

export type ExtensionRuntimeChangeCause =
  | 'startup'
  | 'install'
  | 'enable'
  | 'disable'
  | 'uninstall'
  | 'package-update'
  | 'metadata-change'
  | 'file-change'
  | 'user'
  | 'crash-recovery'
  | 'host-timeout'

export interface ExtensionLoadRequest {
  extension: ExtensionRuntimeMetadata
  generation: number
  cause?: ExtensionRuntimeChangeCause
}

export interface ExtensionUnloadRequest {
  extensionId: string
  reason?: ExtensionUnloadReason
}

export interface ExtensionUnloadResult {
  unloaded: boolean
  deactivateError?: RpcErrorPayload
  cleanupError?: RpcErrorPayload
}

export interface ExtensionReloadRequest {
  extension: ExtensionRuntimeMetadata
  generation: number
  cause?: ExtensionRuntimeChangeCause
}

export interface ExtensionScopedRpcParams {
  extensionId: string
}

export interface ContributionScopedRpcParams extends ExtensionScopedRpcParams {
  contributionId: string
}

export interface EntityMenuContributionRegistration {
  id: string
  target: EntityMenuTarget
  order?: number
}

export interface SettingsPanelContributionRegistration {
  id: string
  title: string
  description?: string
  order?: number
}

export interface DeeplinkContributionRegistration {
  id: string
  route: string
}

export interface GameScraperProviderRegistration {
  id: string
  name: string
  capabilities: readonly ('search' | GameScraperSlot)[]
}

export interface PersonScraperProviderRegistration {
  id: string
  name: string
  capabilities: readonly ('search' | PersonScraperSlot)[]
}

export interface CompanyScraperProviderRegistration {
  id: string
  name: string
  capabilities: readonly ('search' | CompanyScraperSlot)[]
}

export interface CharacterScraperProviderRegistration {
  id: string
  name: string
  capabilities: readonly ('search' | CharacterScraperSlot)[]
}

export interface EntityMenuResolveRequest extends ContributionScopedRpcParams {
  sessionId: string
  input: EntityMenuResolveInput
}

export interface EntityMenuResolveResult {
  items: readonly EntityMenuItem[]
}

export interface EntityMenuInvokeRequest extends ContributionScopedRpcParams {
  sessionId: string
  callbackId: string
  input: EntityMenuResolveInput
  value?: boolean | string
}

export interface SettingsPanelResolveRequest extends ExtensionScopedRpcParams {
  panelId: string
  sessionId: string
}

export interface SettingsPanelResolveResult {
  nodes: readonly SettingsPanelResolvedNode[]
}

export interface SettingsPanelSubmitRequest extends ExtensionScopedRpcParams {
  panelId: string
  sessionId: string
  values: Record<string, SerializableValue>
}

export interface SettingsPanelInvokeRequest extends ExtensionScopedRpcParams {
  panelId: string
  sessionId: string
  callbackId: string
  value?: SerializableValue
}

export interface DeeplinkHandleRequest extends ContributionScopedRpcParams {
  input: DeeplinkRequest
}

export interface ScraperProviderScopedRpcParams extends ExtensionScopedRpcParams {
  providerId: string
}

export interface ScraperSearchRequest extends ScraperProviderScopedRpcParams {
  query: string
  locale?: Locale
}

export interface ScraperResolveRequest extends ScraperProviderScopedRpcParams {
  lookup: ScraperLookup
  locale: Locale
}

export interface ScraperSessionOpenRequest extends ScraperProviderScopedRpcParams {
  target: IdResolvedTarget
  locale: Locale
}

export interface ScraperSessionGetRequest<
  TSlot extends string
> extends ScraperProviderScopedRpcParams {
  sessionId: string
  slots: readonly TSlot[]
}

export interface ScraperSessionCloseRequest extends ScraperProviderScopedRpcParams {
  sessionId: string
}

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

export interface HostEventSubscriptionRequest extends ExtensionScopedRpcParams {
  subscriptionId: string
  topic: HostEventTopic
}

export interface HostEventNotification {
  subscriptionId: string
  topic: HostEventTopic
  payload: HostEvents[HostEventTopic]
}

type LibraryEntityRpcRequestMap<TPrefix extends string, TEntity, TCreate, TPatch, TQuery> = {
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

type ScraperProviderRpcRequestMap<
  TPrefix extends string,
  TSearchResult,
  TSlot extends string,
  TResultMap
> = {
  [K in `${TPrefix}.search`]: RpcMethodDefinition<
    ScraperSearchRequest,
    { results: readonly TSearchResult[] }
  >
} & {
  [K in `${TPrefix}.resolve`]: RpcMethodDefinition<
    ScraperResolveRequest,
    { target: IdResolvedTarget | null }
  >
} & {
  [K in `${TPrefix}.session.open`]: RpcMethodDefinition<
    ScraperSessionOpenRequest,
    { sessionId: string }
  >
} & {
  [K in `${TPrefix}.session.get`]: RpcMethodDefinition<
    ScraperSessionGetRequest<TSlot>,
    { results: Partial<TResultMap> }
  >
} & {
  [K in `${TPrefix}.session.close`]: RpcMethodDefinition<ScraperSessionCloseRequest, RpcNoPayload>
}

export interface MainToHostRpcRequestMap
  extends
    ScraperProviderRpcRequestMap<
      'scrapers.games',
      GameSearchResult,
      GameScraperSlot,
      GameSessionResultMap
    >,
    ScraperProviderRpcRequestMap<
      'scrapers.persons',
      PersonSearchResult,
      PersonScraperSlot,
      PersonSessionResultMap
    >,
    ScraperProviderRpcRequestMap<
      'scrapers.companies',
      CompanySearchResult,
      CompanyScraperSlot,
      CompanySessionResultMap
    >,
    ScraperProviderRpcRequestMap<
      'scrapers.characters',
      CharacterSearchResult,
      CharacterScraperSlot,
      CharacterSessionResultMap
    > {
  'extensions.load': RpcMethodDefinition<ExtensionLoadRequest, RpcNoPayload>
  'extensions.unload': RpcMethodDefinition<ExtensionUnloadRequest, ExtensionUnloadResult>
  'extensions.reload': RpcMethodDefinition<ExtensionReloadRequest, RpcNoPayload>
  'entityMenus.resolve': RpcMethodDefinition<EntityMenuResolveRequest, EntityMenuResolveResult>
  'entityMenus.invoke': RpcMethodDefinition<EntityMenuInvokeRequest, UiCallbackResult>
  'settingsPanels.resolve': RpcMethodDefinition<
    SettingsPanelResolveRequest,
    SettingsPanelResolveResult
  >
  'settingsPanels.submit': RpcMethodDefinition<SettingsPanelSubmitRequest, UiCallbackResult>
  'settingsPanels.invoke': RpcMethodDefinition<SettingsPanelInvokeRequest, UiCallbackResult>
  'deeplinks.handle': RpcMethodDefinition<DeeplinkHandleRequest, DeeplinkResponse>
}

export interface MainToHostRpcEventMap {
  [RPC_ABORT_EVENT]: { requestId: string }
  'capabilities.events.host': HostEventNotification
}

export type HostToMainRpcRequestMap = {
  'bridge.logger.log': RpcMethodDefinition<ExtensionLogRequest, RpcNoPayload>
  'bridge.storage.get': RpcMethodDefinition<StorageGetRequest, StorageGetResult>
  'bridge.storage.set': RpcMethodDefinition<StorageSetRequest, RpcNoPayload>
  'bridge.storage.delete': RpcMethodDefinition<StorageDeleteRequest, RpcNoPayload>
  'bridge.storage.listKeys': RpcMethodDefinition<StorageListKeysRequest, StorageListKeysResult>
  'bridge.entityMenus.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contribution: EntityMenuContributionRegistration },
    RpcNoPayload
  >
  'bridge.entityMenus.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contributionId: string },
    RpcNoPayload
  >
  'bridge.settingsPanels.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contribution: SettingsPanelContributionRegistration },
    RpcNoPayload
  >
  'bridge.settingsPanels.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { panelId: string },
    RpcNoPayload
  >
  'bridge.scrapers.games.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { provider: GameScraperProviderRegistration },
    RpcNoPayload
  >
  'bridge.scrapers.games.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { providerId: string },
    RpcNoPayload
  >
  'bridge.scrapers.persons.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { provider: PersonScraperProviderRegistration },
    RpcNoPayload
  >
  'bridge.scrapers.persons.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { providerId: string },
    RpcNoPayload
  >
  'bridge.scrapers.companies.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { provider: CompanyScraperProviderRegistration },
    RpcNoPayload
  >
  'bridge.scrapers.companies.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { providerId: string },
    RpcNoPayload
  >
  'bridge.scrapers.characters.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { provider: CharacterScraperProviderRegistration },
    RpcNoPayload
  >
  'bridge.scrapers.characters.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { providerId: string },
    RpcNoPayload
  >
  'bridge.deeplinks.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contribution: DeeplinkContributionRegistration },
    RpcNoPayload
  >
  'bridge.deeplinks.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contributionId: string },
    RpcNoPayload
  >
  'bridge.themes.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { theme: ThemeContribution },
    RpcNoPayload
  >
  'bridge.themes.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { themeId: string },
    RpcNoPayload
  >
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

export type HostToMainRpcEventMap = Record<never, never>

export type ExtensionBridgeRpcRequestMap = MainToHostRpcRequestMap & HostToMainRpcRequestMap

export type ExtensionBridgeRpcEventMap = MainToHostRpcEventMap & HostToMainRpcEventMap

export type MainToHostRpcMethod = RpcMethodName<MainToHostRpcRequestMap>

export type HostToMainRpcMethod = RpcMethodName<HostToMainRpcRequestMap>

export type ExtensionBridgeRpcMethod = RpcMethodName<ExtensionBridgeRpcRequestMap>

export type MainToHostRpcEvent = RpcEventName<MainToHostRpcEventMap>

export type HostToMainRpcEvent = RpcEventName<HostToMainRpcEventMap>

export type ExtensionBridgeRpcEvent = RpcEventName<ExtensionBridgeRpcEventMap>

export type MainToHostRpcRequestMessage<TMethod extends MainToHostRpcMethod = MainToHostRpcMethod> =
  RpcTypedRequestMessage<MainToHostRpcRequestMap, TMethod>

export type MainToHostRpcResponseMessage<
  TMethod extends MainToHostRpcMethod = MainToHostRpcMethod
> = RpcTypedResponseMessage<MainToHostRpcRequestMap, TMethod>

export type MainToHostRpcEventMessage<TEvent extends MainToHostRpcEvent = MainToHostRpcEvent> =
  RpcTypedEventMessage<MainToHostRpcEventMap, TEvent>

export type HostToMainRpcRequestMessage<TMethod extends HostToMainRpcMethod = HostToMainRpcMethod> =
  RpcTypedRequestMessage<HostToMainRpcRequestMap, TMethod>

export type HostToMainRpcResponseMessage<
  TMethod extends HostToMainRpcMethod = HostToMainRpcMethod
> = RpcTypedResponseMessage<HostToMainRpcRequestMap, TMethod>

export type HostToMainRpcEventMessage<TEvent extends HostToMainRpcEvent = HostToMainRpcEvent> =
  RpcTypedEventMessage<HostToMainRpcEventMap, TEvent>
