import type {
  Disposable,
  ExtensionEventListener,
  ExtensionEventPayload,
  ExtensionEventTopic,
  HostEventListener,
  HostEventTopic,
  HostToMainRpcMethod,
  HostToMainRpcRequestMap,
  KisakiApi,
  LibraryCapability,
  LibraryRelation,
  LibraryRelationCreateInput,
  LibraryRelationKind,
  LibraryRelationPatch,
  LibraryRelationSelector,
  NetworkDownloadRequest,
  NetworkRequest,
  NetworkResponse,
  RpcParams,
  RpcResult
} from '@kisaki/extension-api'
import type { ActiveExtensionScope } from './types'

type ScopedHostToMainRpcParams<K extends HostToMainRpcMethod> = Omit<
  RpcParams<HostToMainRpcRequestMap, K>,
  'runtimeHandle'
>

type LibraryEntityPrefix =
  | 'capabilities.library.games'
  | 'capabilities.library.characters'
  | 'capabilities.library.persons'
  | 'capabilities.library.companies'
  | 'capabilities.library.collections'
  | 'capabilities.library.tags'

type LibraryEntityNamespaceFacade =
  | LibraryCapability['games']
  | LibraryCapability['characters']
  | LibraryCapability['persons']
  | LibraryCapability['companies']
  | LibraryCapability['collections']
  | LibraryCapability['tags']

type LibraryEntityMethod<
  TPrefix extends LibraryEntityPrefix,
  TAction extends 'get' | 'list' | 'create' | 'update' | 'remove'
> = Extract<HostToMainRpcMethod, `${TPrefix}.${TAction}`>
type LibraryEntityGetMethod = LibraryEntityMethod<LibraryEntityPrefix, 'get'>
type LibraryEntityListMethod = LibraryEntityMethod<LibraryEntityPrefix, 'list'>
type LibraryEntityCreateMethod = LibraryEntityMethod<LibraryEntityPrefix, 'create'>
type LibraryEntityUpdateMethod = LibraryEntityMethod<LibraryEntityPrefix, 'update'>
type LibraryEntityRemoveMethod = LibraryEntityMethod<LibraryEntityPrefix, 'remove'>

interface LibraryEntityMethods {
  get: LibraryEntityGetMethod
  list: LibraryEntityListMethod
  create: LibraryEntityCreateMethod
  update: LibraryEntityUpdateMethod
  remove: LibraryEntityRemoveMethod
}

interface KisakiApiBridgeHooks {
  requireCurrentScope(): ActiveExtensionScope
  requestMain<K extends HostToMainRpcMethod>(
    scope: ActiveExtensionScope,
    method: K,
    params: ScopedHostToMainRpcParams<K>
  ): Promise<RpcResult<HostToMainRpcRequestMap, K>>
  subscribeHostEvent<K extends HostEventTopic>(
    topic: K,
    listener: HostEventListener<K>,
    once: boolean
  ): Promise<Disposable>
  subscribeExtensionEvent<TPayload extends ExtensionEventPayload>(
    topic: ExtensionEventTopic,
    listener: ExtensionEventListener<TPayload>
  ): Promise<Disposable>
  emitExtensionEvent<TPayload extends ExtensionEventPayload>(
    topic: ExtensionEventTopic,
    payload: TPayload
  ): Promise<void>
}

/**
 * Creates the public Kisaki SDK API facade for the active extension scope.
 */
export function createKisakiApi(hooks: KisakiApiBridgeHooks): KisakiApi {
  const requestMain = <K extends HostToMainRpcMethod>(
    method: K,
    params: ScopedHostToMainRpcParams<K>
  ) => {
    const scope = hooks.requireCurrentScope()
    return hooks.requestMain(scope, method, params)
  }

  const createEntityNamespace = <TNamespace extends LibraryEntityNamespaceFacade>(
    methods: LibraryEntityMethods
  ): TNamespace => {
    return {
      get: async (id: string) =>
        (
          (await requestMain(methods.get, { id } as unknown as ScopedHostToMainRpcParams<
            typeof methods.get
          >)) as { entity: unknown }
        ).entity,
      list: async (query?: unknown) =>
        (
          (await requestMain(methods.list, { query } as unknown as ScopedHostToMainRpcParams<
            typeof methods.list
          >)) as { items: readonly unknown[] }
        ).items,
      create: async (input: unknown) =>
        (
          (await requestMain(methods.create, { input } as unknown as ScopedHostToMainRpcParams<
            typeof methods.create
          >)) as { entity: unknown }
        ).entity,
      update: async (id: string, patch: unknown) =>
        (
          (await requestMain(methods.update, {
            id,
            patch
          } as unknown as ScopedHostToMainRpcParams<typeof methods.update>)) as { entity: unknown }
        ).entity,
      remove: async (id: string) => {
        await requestMain(methods.remove, { id } as unknown as ScopedHostToMainRpcParams<
          typeof methods.remove
        >)
      }
    } as unknown as TNamespace
  }

  return {
    library: {
      games: createEntityNamespace<LibraryCapability['games']>({
        get: 'capabilities.library.games.get',
        list: 'capabilities.library.games.list',
        create: 'capabilities.library.games.create',
        update: 'capabilities.library.games.update',
        remove: 'capabilities.library.games.remove'
      }),
      characters: createEntityNamespace<LibraryCapability['characters']>({
        get: 'capabilities.library.characters.get',
        list: 'capabilities.library.characters.list',
        create: 'capabilities.library.characters.create',
        update: 'capabilities.library.characters.update',
        remove: 'capabilities.library.characters.remove'
      }),
      persons: createEntityNamespace<LibraryCapability['persons']>({
        get: 'capabilities.library.persons.get',
        list: 'capabilities.library.persons.list',
        create: 'capabilities.library.persons.create',
        update: 'capabilities.library.persons.update',
        remove: 'capabilities.library.persons.remove'
      }),
      companies: createEntityNamespace<LibraryCapability['companies']>({
        get: 'capabilities.library.companies.get',
        list: 'capabilities.library.companies.list',
        create: 'capabilities.library.companies.create',
        update: 'capabilities.library.companies.update',
        remove: 'capabilities.library.companies.remove'
      }),
      collections: createEntityNamespace<LibraryCapability['collections']>({
        get: 'capabilities.library.collections.get',
        list: 'capabilities.library.collections.list',
        create: 'capabilities.library.collections.create',
        update: 'capabilities.library.collections.update',
        remove: 'capabilities.library.collections.remove'
      }),
      tags: createEntityNamespace<LibraryCapability['tags']>({
        get: 'capabilities.library.tags.get',
        list: 'capabilities.library.tags.list',
        create: 'capabilities.library.tags.create',
        update: 'capabilities.library.tags.update',
        remove: 'capabilities.library.tags.remove'
      }),
      relations: {
        list: async (query) =>
          (
            await requestMain('capabilities.library.relations.list', {
              query
            })
          ).items,
        create: async <K extends LibraryRelationKind>(input: LibraryRelationCreateInput<K>) =>
          (
            await requestMain('capabilities.library.relations.create', {
              input
            })
          ).relation as LibraryRelation<K>,
        update: async <K extends LibraryRelationKind>(
          selector: LibraryRelationSelector<K>,
          patch: LibraryRelationPatch<K>
        ) =>
          (
            await requestMain('capabilities.library.relations.update', {
              selector: selector as unknown as LibraryRelationSelector,
              patch: patch as unknown as LibraryRelationPatch
            })
          ).relation as LibraryRelation<K>,
        remove: async (selector) => {
          await requestMain('capabilities.library.relations.remove', {
            selector: selector as unknown as LibraryRelationSelector
          })
        }
      },
      attachments: {
        list: async (entity) =>
          (
            await requestMain('capabilities.library.attachments.list', {
              entity
            })
          ).items,
        put: async (input) =>
          (
            await requestMain('capabilities.library.attachments.put', {
              input
            })
          ).attachment,
        remove: async (input) => {
          await requestMain('capabilities.library.attachments.remove', { input })
        }
      }
    },
    network: {
      request: async <TData = unknown>(input: NetworkRequest): Promise<NetworkResponse<TData>> =>
        (await requestMain('capabilities.network.request', { input }))
          .response as NetworkResponse<TData>,
      download: async (input: NetworkDownloadRequest) =>
        (await requestMain('capabilities.network.download', { input })).result
    },
    notify: {
      success: async (title, options) =>
        (
          await requestMain('capabilities.notify.show', {
            kind: 'success',
            title,
            options
          })
        ).handle,
      info: async (title, options) =>
        (
          await requestMain('capabilities.notify.show', {
            kind: 'info',
            title,
            options
          })
        ).handle,
      warning: async (title, options) =>
        (
          await requestMain('capabilities.notify.show', {
            kind: 'warning',
            title,
            options
          })
        ).handle,
      error: async (title, options) =>
        (
          await requestMain('capabilities.notify.show', {
            kind: 'error',
            title,
            options
          })
        ).handle,
      loading: async (title, options) =>
        (
          await requestMain('capabilities.notify.show', {
            kind: 'loading',
            title,
            options
          })
        ).handle,
      update: async (id, kind, title, options) => {
        await requestMain('capabilities.notify.update', {
          id,
          kind,
          title,
          options
        })
      },
      dismiss: async (id) => {
        await requestMain('capabilities.notify.dismiss', { id })
      }
    },
    events: {
      on: async (topic, listener) => hooks.subscribeHostEvent(topic, listener, false),
      once: async (topic, listener) => hooks.subscribeHostEvent(topic, listener, true),
      onExtension: async (topic, listener) => hooks.subscribeExtensionEvent(topic, listener),
      emit: async (topic, payload) => hooks.emitExtensionEvent(topic, payload)
    },
    runtime: {
      getInfo: async () => {
        return (await requestMain('capabilities.runtime.getInfo', {})).info
      },
      delay: async (ms: number) => {
        await new Promise((resolve) => setTimeout(resolve, ms))
      }
    }
  }
}
