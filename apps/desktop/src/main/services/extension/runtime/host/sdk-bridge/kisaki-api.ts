import { ExtensionTaskRunCancellation, readErrorCode } from '@kisaki3/extension-api'
import type {
  Disposable,
  ExtensionEventListener,
  ExtensionEventPayload,
  ExtensionEventTopic,
  ExtensionTaskRunActiveListQuery,
  ExtensionTaskRunCreateInput,
  ExtensionTaskRunFailureErrorPayload,
  ExtensionTaskRunHandle,
  ExtensionTaskRunHistoryListQuery,
  ExtensionTaskRunProgressUpdate,
  ExtensionTaskRunSnapshot,
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
} from '@kisaki3/extension-api'
import type { ActiveExtensionScope } from './types'
import {
  JSON_COMPATIBLE_UNDEFINED_SERIALIZATION,
  toSerializableRecord
} from './utils/serialization'

const TASK_RUN_CANCELLED_ERROR_CODE = 'task_run_cancelled'

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

export interface KisakiApiBridgeHooks {
  requireCurrentScope(): ActiveExtensionScope
  requestMain<K extends HostToMainRpcMethod>(
    scope: ActiveExtensionScope,
    method: K,
    params: ScopedHostToMainRpcParams<K>
  ): Promise<RpcResult<HostToMainRpcRequestMap, K>>
  subscribeHostEvent<K extends HostEventTopic>(
    scope: ActiveExtensionScope,
    topic: K,
    listener: HostEventListener<K>,
    once: boolean
  ): Promise<Disposable>
  subscribeExtensionEvent<TPayload extends ExtensionEventPayload>(
    scope: ActiveExtensionScope,
    topic: ExtensionEventTopic,
    listener: ExtensionEventListener<TPayload>
  ): Promise<Disposable>
  emitExtensionEvent<TPayload extends ExtensionEventPayload>(
    scope: ActiveExtensionScope,
    topic: ExtensionEventTopic,
    payload: TPayload
  ): Promise<void>
  registerTaskRunAbortController(
    scope: ActiveExtensionScope,
    runId: string,
    controller: AbortController
  ): Disposable
}

/**
 * Creates a public Kisaki SDK API facade. When boundScope is provided, all
 * capability calls stay tied to that extension even after the original
 * activation stack has unwound.
 */
export function createKisakiApi(
  hooks: KisakiApiBridgeHooks,
  boundScope?: ActiveExtensionScope
): KisakiApi {
  const requireScope = () => boundScope ?? hooks.requireCurrentScope()

  const requestMain = <K extends HostToMainRpcMethod>(
    method: K,
    params: ScopedHostToMainRpcParams<K>
  ) => {
    const scope = requireScope()
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

  const createTaskRunHandle = (run: ExtensionTaskRunSnapshot): ExtensionTaskRunHandle => {
    const scope = requireScope()
    const controller = new AbortController()
    const registration = hooks.registerTaskRunAbortController(scope, run.id, controller)
    let disposed = false

    const dispose = () => {
      if (disposed) {
        return
      }

      disposed = true
      registration.dispose()
    }

    const throwIfCancelled = () => {
      if (controller.signal.aborted) {
        throw new ExtensionTaskRunCancellation()
      }
    }

    const mapTaskRunError = (error: unknown): never => {
      if (controller.signal.aborted || readErrorCode(error) === TASK_RUN_CANCELLED_ERROR_CODE) {
        throw new ExtensionTaskRunCancellation()
      }

      throw error
    }

    return {
      id: run.id,
      signal: controller.signal,
      report: async (update) => {
        throwIfCancelled()
        try {
          await requestMain('capabilities.taskRuns.report', {
            runId: run.id,
            update: toJsonCompatibleRecord<ExtensionTaskRunProgressUpdate>(
              update,
              'task run progress update'
            )
          })
        } catch (error) {
          mapTaskRunError(error)
        }
      },
      checkpoint: async () => {
        throwIfCancelled()
        try {
          await requestMain('capabilities.taskRuns.checkpoint', { runId: run.id })
        } catch (error) {
          mapTaskRunError(error)
        }
        throwIfCancelled()
      },
      complete: async (result) => {
        await requestMain('capabilities.taskRuns.complete', {
          runId: run.id,
          result: toOptionalJsonCompatibleRecord(result, 'task run result')
        })
        dispose()
      },
      fail: async (error, result) => {
        await requestMain('capabilities.taskRuns.fail', {
          runId: run.id,
          error: toTaskRunFailureErrorPayload(error),
          result: toOptionalJsonCompatibleRecord(result, 'task run result')
        })
        dispose()
      },
      cancel: async (result) => {
        await requestMain('capabilities.taskRuns.cancel', {
          runId: run.id,
          result: toOptionalJsonCompatibleRecord(result, 'task run result')
        })
        controller.abort()
        dispose()
      }
    }
  }

  return {
    files: {
      pickFile: async (input) =>
        (
          await requestMain('capabilities.files.pickFile', {
            input
          })
        ).grant,
      releaseGrant: async (grantId) => {
        await requestMain('capabilities.files.releaseGrant', { grantId })
      }
    },
    library: {
      graph: {
        preview: async (input) =>
          (
            await requestMain('capabilities.library.graph.preview', {
              input
            })
          ).result,
        apply: async (input) =>
          (
            await requestMain('capabilities.library.graph.apply', {
              input
            })
          ).result
      },
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
      on: async (topic, listener) =>
        hooks.subscribeHostEvent(requireScope(), topic, listener, false),
      once: async (topic, listener) =>
        hooks.subscribeHostEvent(requireScope(), topic, listener, true),
      onExtension: async (topic, listener) =>
        hooks.subscribeExtensionEvent(requireScope(), topic, listener),
      emit: async (topic, payload) => hooks.emitExtensionEvent(requireScope(), topic, payload)
    },
    runtime: {
      getInfo: async () => {
        return (await requestMain('capabilities.runtime.getInfo', {})).info
      },
      delay: async (ms: number) => {
        await new Promise((resolve) => setTimeout(resolve, ms))
      },
      openExternal: async (url: string) => {
        await requestMain('capabilities.runtime.openExternal', { url })
      }
    },
    scrapers: {
      profiles: {
        list: async (query) =>
          (
            await requestMain('capabilities.scrapers.profiles.list', {
              query
            })
          ).items,
        get: async (profileId) =>
          (
            await requestMain('capabilities.scrapers.profiles.get', {
              profileId
            })
          ).profile
      }
    },
    ingest: {
      game: {
        add: {
          fromScraper: async (profileId, lookup, options) =>
            (
              await requestMain('capabilities.ingest.game.add.fromScraper', {
                profileId,
                lookup,
                options
              })
            ).result
        },
        update: {
          fromScraper: async (input, options) =>
            (
              await requestMain('capabilities.ingest.game.update.fromScraper', {
                input,
                options
              })
            ).result
        }
      }
    },
    commands: {
      list: async () => (await requestMain('capabilities.commands.list', {})).items,
      get: async (commandId) =>
        (
          await requestMain('capabilities.commands.get', {
            commandId
          })
        ).command,
      invoke: async (request) =>
        (
          await requestMain('capabilities.commands.invoke', {
            request
          })
        ).result
    },
    automations: {
      list: async () => (await requestMain('capabilities.automations.list', {})).items,
      get: async (automationId) =>
        (
          await requestMain('capabilities.automations.get', {
            automationId
          })
        ).automation,
      create: async (input) =>
        (
          await requestMain('capabilities.automations.create', {
            input
          })
        ).automation,
      update: async (automationId, patch) =>
        (
          await requestMain('capabilities.automations.update', {
            automationId,
            patch
          })
        ).automation,
      setEnabled: async (automationId, enabled) =>
        (
          await requestMain('capabilities.automations.setEnabled', {
            automationId,
            enabled
          })
        ).automation,
      delete: async (automationId) => {
        await requestMain('capabilities.automations.delete', { automationId })
      },
      run: async (automationId) =>
        (
          await requestMain('capabilities.automations.run', {
            automationId
          })
        ).record
    },
    taskRuns: {
      create: async (input) =>
        createTaskRunHandle(
          (
            await requestMain('capabilities.taskRuns.create', {
              input: toJsonCompatibleRecord<ExtensionTaskRunCreateInput>(
                input,
                'task run create input'
              )
            })
          ).run
        ),
      listActiveOwn: async (query) =>
        (
          await requestMain('capabilities.taskRuns.listActiveOwn', {
            query: toOptionalJsonCompatibleRecord<ExtensionTaskRunActiveListQuery>(
              query,
              'task run active query'
            )
          })
        ).items,
      listHistoryOwn: async (query) =>
        (
          await requestMain('capabilities.taskRuns.listHistoryOwn', {
            query: toOptionalJsonCompatibleRecord<ExtensionTaskRunHistoryListQuery>(
              query,
              'task run history query'
            )
          })
        ).items,
      getActiveOwn: async (runId) =>
        (
          await requestMain('capabilities.taskRuns.getActiveOwn', {
            runId
          })
        ).run,
      getHistoryOwn: async (runId) =>
        (
          await requestMain('capabilities.taskRuns.getHistoryOwn', {
            runId
          })
        ).run,
      waitOwn: async (runId) =>
        (
          await requestMain('capabilities.taskRuns.waitOwn', {
            runId
          })
        ).run
    }
  }
}

export function createScopeCapturingKisakiApi(
  hooks: KisakiApiBridgeHooks,
  getScopedApi: (scope: ActiveExtensionScope) => KisakiApi
): KisakiApi {
  const getApi = () => getScopedApi(hooks.requireCurrentScope())

  return {
    get files() {
      return getApi().files
    },
    get library() {
      return getApi().library
    },
    get network() {
      return getApi().network
    },
    get notify() {
      return getApi().notify
    },
    get events() {
      return getApi().events
    },
    get runtime() {
      return getApi().runtime
    },
    get scrapers() {
      return getApi().scrapers
    },
    get ingest() {
      return getApi().ingest
    },
    get commands() {
      return getApi().commands
    },
    get automations() {
      return getApi().automations
    },
    get taskRuns() {
      return getApi().taskRuns
    }
  }
}

function toTaskRunFailureErrorPayload(error: unknown): ExtensionTaskRunFailureErrorPayload {
  if (error instanceof Error) {
    const message = error.message.trim()
    const code = readErrorCode(error)
    return {
      message: message || 'Extension task run failed.',
      ...(code ? { code } : {})
    }
  }

  if (typeof error === 'string' && error.trim()) {
    return {
      message: error.trim()
    }
  }

  return {
    message: 'Extension task run failed.'
  }
}

function toOptionalJsonCompatibleRecord<TRecord extends object>(
  value: TRecord | undefined,
  label: string
): TRecord | undefined {
  return value === undefined ? undefined : toJsonCompatibleRecord(value, label)
}

function toJsonCompatibleRecord<TRecord extends object>(value: TRecord, label: string): TRecord {
  return toSerializableRecord(
    value,
    label,
    JSON_COMPATIBLE_UNDEFINED_SERIALIZATION
  ) as unknown as TRecord
}
