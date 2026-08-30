import { TaskRunCancellation, isCancellationError } from '@kisaki3/extension-api'
import type {
  Disposable,
  TaskRunHandle,
  TaskRunSnapshot,
  HostToMainRpcMethod,
  HostToMainRpcRequestMap,
  KisakiApi,
  LibraryCapability,
  LibraryLink,
  LibraryLinkCreateInput,
  LibraryLinkKind,
  LibraryLinkPatch,
  LibraryLinkSelector,
  LibraryMediaRelationPatch,
  LibraryMediaRelationSelector,
  NetworkCallOptions,
  NetworkDownloadRequest,
  NetworkRequest,
  NetworkResponse,
  RpcParams,
  RpcResult,
  UiLocale,
  UndefinedTolerant,
  WebviewHandle,
  WebviewOpenOptions
} from '@kisaki3/extension-api'
import type { ActiveExtensionScope } from './types'
import { toTaskRunFailureErrorPayload } from './utils/task-runs'

// Callers construct outbound params, so optional members tolerate explicit
// undefined; the wire normalizer drops them before transport.
type ScopedHostToMainRpcParams<K extends HostToMainRpcMethod> = UndefinedTolerant<
  Omit<RpcParams<HostToMainRpcRequestMap, K>, 'runtimeHandle'>
>

type LibraryEntityPrefix =
  | 'capabilities.library.games'
  | 'capabilities.library.animes'
  | 'capabilities.library.comics'
  | 'capabilities.library.novels'
  | 'capabilities.library.characters'
  | 'capabilities.library.persons'
  | 'capabilities.library.companies'
  | 'capabilities.library.collections'
  | 'capabilities.library.tags'

/** Anime owns an `episodes` sub-namespace that the generic CRUD facade does not build. */
type LibraryAnimeEntityFacade = Omit<LibraryCapability['animes'], 'episodes'>
/** Comic owns a `chapters` sub-namespace that the generic CRUD facade does not build. */
type LibraryComicEntityFacade = Omit<LibraryCapability['comics'], 'chapters'>
/** Novel owns a `volumes` sub-namespace that the generic CRUD facade does not build. */
type LibraryNovelEntityFacade = Omit<LibraryCapability['novels'], 'volumes'>

type LibraryEntityNamespaceFacade =
  | LibraryCapability['games']
  | LibraryAnimeEntityFacade
  | LibraryComicEntityFacade
  | LibraryNovelEntityFacade
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

export interface KisakiApiBridgeDelegate {
  requireCurrentScope(): ActiveExtensionScope
  getUiLocale(): UiLocale
  requestMain<K extends HostToMainRpcMethod>(
    scope: ActiveExtensionScope,
    method: K,
    params: ScopedHostToMainRpcParams<K>,
    signal?: AbortSignal
  ): Promise<RpcResult<HostToMainRpcRequestMap, K>>
  registerTaskRunAbortController(
    scope: ActiveExtensionScope,
    runId: string,
    controller: AbortController
  ): Disposable
  createWebviewSession(scope: ActiveExtensionScope, webviewId: string): WebviewHandle
}

/**
 * Creates a public Kisaki SDK API facade. When boundScope is provided, all
 * capability calls stay tied to that extension even after the original
 * activation stack has unwound.
 * @remarks The facade passes payloads through untouched: the RPC channel
 * normalizes every outgoing value into the wire domain (rejecting non-JSON
 * input synchronously at the call site), and the main-process capability
 * providers are the authoritative validators of payload shapes and limits.
 */
export function createKisakiApi(
  delegate: KisakiApiBridgeDelegate,
  boundScope?: ActiveExtensionScope
): KisakiApi {
  const requireScope = () => boundScope ?? delegate.requireCurrentScope()

  const requestMain = <K extends HostToMainRpcMethod>(
    method: K,
    params: ScopedHostToMainRpcParams<K>,
    signal?: AbortSignal
  ) => {
    const scope = requireScope()
    return delegate.requestMain(scope, method, params, signal)
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

  const openWebviewPage = async (
    pageId: string,
    options?: WebviewOpenOptions
  ): Promise<WebviewHandle> => {
    const scope = requireScope()
    const { webviewId } = await requestMain('capabilities.webviews.openPage', {
      pageId,
      ...(options === undefined ? {} : { options })
    })
    return delegate.createWebviewSession(scope, webviewId)
  }

  const openWebviewDialog = async (
    dialogId: string,
    options?: WebviewOpenOptions
  ): Promise<WebviewHandle> => {
    const scope = requireScope()
    const { webviewId } = await requestMain('capabilities.webviews.openDialog', {
      dialogId,
      ...(options === undefined ? {} : { options })
    })
    return delegate.createWebviewSession(scope, webviewId)
  }

  const createTaskRunHandle = (run: TaskRunSnapshot): TaskRunHandle => {
    const scope = requireScope()
    const controller = new AbortController()
    const registration = delegate.registerTaskRunAbortController(scope, run.id, controller)
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
        throw new TaskRunCancellation()
      }
    }

    const mapTaskRunError = (error: unknown): never => {
      if (controller.signal.aborted || isCancellationError(error)) {
        throw new TaskRunCancellation()
      }

      throw error
    }

    return {
      id: run.id,
      signal: controller.signal,
      report: async (update) => {
        throwIfCancelled()
        try {
          await requestMain('capabilities.taskRuns.report', { runId: run.id, update })
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
        await requestMain('capabilities.taskRuns.complete', { runId: run.id, result })
        dispose()
      },
      fail: async (error, result) => {
        await requestMain('capabilities.taskRuns.fail', {
          runId: run.id,
          error: toTaskRunFailureErrorPayload(error),
          result
        })
        dispose()
      },
      cancel: async (result) => {
        await requestMain('capabilities.taskRuns.cancel', { runId: run.id, result })
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
      },
      getFileIcon: async (path, input) =>
        (
          await requestMain('capabilities.files.getFileIcon', {
            path,
            ...(input === undefined ? {} : { input })
          })
        ).icon
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
      animes: {
        ...createEntityNamespace<LibraryAnimeEntityFacade>({
          get: 'capabilities.library.animes.get',
          list: 'capabilities.library.animes.list',
          create: 'capabilities.library.animes.create',
          update: 'capabilities.library.animes.update',
          remove: 'capabilities.library.animes.remove'
        }),
        episodes: {
          list: async (query) =>
            (await requestMain('capabilities.library.animes.episodes.list', { query })).items,
          create: async (animeId, input) =>
            (
              await requestMain('capabilities.library.animes.episodes.create', {
                animeId,
                input
              })
            ).episode,
          patchWatchState: async (episodeId, patch) =>
            (
              await requestMain('capabilities.library.animes.episodes.patchWatchState', {
                episodeId,
                patch
              })
            ).episode
        }
      },
      comics: {
        ...createEntityNamespace<LibraryComicEntityFacade>({
          get: 'capabilities.library.comics.get',
          list: 'capabilities.library.comics.list',
          create: 'capabilities.library.comics.create',
          update: 'capabilities.library.comics.update',
          remove: 'capabilities.library.comics.remove'
        }),
        chapters: {
          list: async (query) =>
            (await requestMain('capabilities.library.comics.chapters.list', { query })).items,
          create: async (comicId, input) =>
            (
              await requestMain('capabilities.library.comics.chapters.create', {
                comicId,
                input
              })
            ).chapter,
          patchReadState: async (chapterId, patch) =>
            (
              await requestMain('capabilities.library.comics.chapters.patchReadState', {
                chapterId,
                patch
              })
            ).chapter
        }
      },
      novels: {
        ...createEntityNamespace<LibraryNovelEntityFacade>({
          get: 'capabilities.library.novels.get',
          list: 'capabilities.library.novels.list',
          create: 'capabilities.library.novels.create',
          update: 'capabilities.library.novels.update',
          remove: 'capabilities.library.novels.remove'
        }),
        volumes: {
          list: async (query) =>
            (await requestMain('capabilities.library.novels.volumes.list', { query })).items,
          create: async (novelId, input) =>
            (
              await requestMain('capabilities.library.novels.volumes.create', {
                novelId,
                input
              })
            ).volume,
          patchReadState: async (volumeId, patch) =>
            (
              await requestMain('capabilities.library.novels.volumes.patchReadState', {
                volumeId,
                patch
              })
            ).volume
        }
      },
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
      links: {
        list: async (query) =>
          (
            await requestMain('capabilities.library.links.list', {
              query
            })
          ).items,
        create: async <K extends LibraryLinkKind>(input: LibraryLinkCreateInput<K>) =>
          (
            await requestMain('capabilities.library.links.create', {
              input
            })
          ).link as LibraryLink<K>,
        update: async <K extends LibraryLinkKind>(
          selector: LibraryLinkSelector<K>,
          patch: LibraryLinkPatch<K>
        ) =>
          (
            await requestMain('capabilities.library.links.update', {
              selector: selector as unknown as LibraryLinkSelector,
              patch: patch as unknown as LibraryLinkPatch
            })
          ).link as LibraryLink<K>,
        remove: async (selector) => {
          await requestMain('capabilities.library.links.remove', {
            selector: selector as unknown as LibraryLinkSelector
          })
        }
      },
      relations: {
        list: async (query) =>
          (
            await requestMain('capabilities.library.relations.list', {
              query
            })
          ).items,
        create: async (input) =>
          (
            await requestMain('capabilities.library.relations.create', {
              input
            })
          ).relation,
        update: async (selector, patch) =>
          (
            await requestMain('capabilities.library.relations.update', {
              selector: selector as LibraryMediaRelationSelector,
              patch: patch as LibraryMediaRelationPatch
            })
          ).relation,
        remove: async (selector) => {
          await requestMain('capabilities.library.relations.remove', {
            selector: selector as LibraryMediaRelationSelector
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
      request: async <TData = unknown>(
        input: NetworkRequest,
        options?: NetworkCallOptions
      ): Promise<NetworkResponse<TData>> =>
        (await requestMain('capabilities.network.request', { input }, options?.signal))
          .response as NetworkResponse<TData>,
      download: async (input: NetworkDownloadRequest, options?: NetworkCallOptions) =>
        (await requestMain('capabilities.network.download', { input }, options?.signal)).result
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
    runtime: {
      get uiLocale() {
        return delegate.getUiLocale()
      },
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
            ).result,
          startFromScraper: async (profileId, lookup, options) =>
            (
              await requestMain('capabilities.ingest.game.add.startFromScraper', {
                profileId,
                lookup,
                options
              })
            ).start
        },
        update: {
          fromScraper: async (input) =>
            (await requestMain('capabilities.ingest.game.update.fromScraper', { input })).result,
          startFromScraper: async (input) =>
            (await requestMain('capabilities.ingest.game.update.startFromScraper', { input })).start
        }
      },
      anime: {
        add: {
          fromScraper: async (profileId, lookup, options) =>
            (
              await requestMain('capabilities.ingest.anime.add.fromScraper', {
                profileId,
                lookup,
                options
              })
            ).result,
          startFromScraper: async (profileId, lookup, options) =>
            (
              await requestMain('capabilities.ingest.anime.add.startFromScraper', {
                profileId,
                lookup,
                options
              })
            ).start
        },
        update: {
          fromScraper: async (input) =>
            (await requestMain('capabilities.ingest.anime.update.fromScraper', { input })).result,
          startFromScraper: async (input) =>
            (await requestMain('capabilities.ingest.anime.update.startFromScraper', { input }))
              .start
        }
      },
      comic: {
        add: {
          fromScraper: async (profileId, lookup, options) =>
            (
              await requestMain('capabilities.ingest.comic.add.fromScraper', {
                profileId,
                lookup,
                options
              })
            ).result,
          startFromScraper: async (profileId, lookup, options) =>
            (
              await requestMain('capabilities.ingest.comic.add.startFromScraper', {
                profileId,
                lookup,
                options
              })
            ).start
        },
        update: {
          fromScraper: async (input) =>
            (await requestMain('capabilities.ingest.comic.update.fromScraper', { input })).result,
          startFromScraper: async (input) =>
            (await requestMain('capabilities.ingest.comic.update.startFromScraper', { input }))
              .start
        }
      },
      novel: {
        add: {
          fromScraper: async (profileId, lookup, options) =>
            (
              await requestMain('capabilities.ingest.novel.add.fromScraper', {
                profileId,
                lookup,
                options
              })
            ).result,
          startFromScraper: async (profileId, lookup, options) =>
            (
              await requestMain('capabilities.ingest.novel.add.startFromScraper', {
                profileId,
                lookup,
                options
              })
            ).start
        },
        update: {
          fromScraper: async (input) =>
            (await requestMain('capabilities.ingest.novel.update.fromScraper', { input })).result,
          startFromScraper: async (input) =>
            (await requestMain('capabilities.ingest.novel.update.startFromScraper', { input }))
              .start
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
        (await requestMain('capabilities.commands.invoke', { request })).result
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
        (await requestMain('capabilities.automations.create', { input })).automation,
      update: async (automationId, patch) =>
        (await requestMain('capabilities.automations.update', { automationId, patch })).automation,
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
        createTaskRunHandle((await requestMain('capabilities.taskRuns.create', { input })).run),
      listActiveOwn: async (query) =>
        (await requestMain('capabilities.taskRuns.listActiveOwn', { query })).items,
      listHistoryOwn: async (query) =>
        (await requestMain('capabilities.taskRuns.listHistoryOwn', { query })).items,
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
      cancelOwn: async (runId) =>
        (
          await requestMain('capabilities.taskRuns.cancelOwn', {
            runId
          })
        ).cancelled,
      waitOwn: async (runId) =>
        (
          await requestMain('capabilities.taskRuns.waitOwn', {
            runId
          })
        ).run
    },
    webviews: {
      openPage: openWebviewPage,
      openDialog: openWebviewDialog
    }
  }
}

export function createScopeCapturingKisakiApi(
  delegate: KisakiApiBridgeDelegate,
  getScopedApi: (scope: ActiveExtensionScope) => KisakiApi
): KisakiApi {
  const getApi = () => getScopedApi(delegate.requireCurrentScope())

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
    },
    get webviews() {
      return getApi().webviews
    }
  }
}
