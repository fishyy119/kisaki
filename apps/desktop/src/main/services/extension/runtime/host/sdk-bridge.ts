import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type {
  CharacterScraperProvider,
  CompanyScraperProvider,
  DeeplinkContribution,
  Disposable,
  DisposableStore,
  EntityMenuContribution,
  ExtensionContext,
  ExtensionEventListener,
  ExtensionEventPayload,
  ExtensionEventTopic,
  ExtensionLogger,
  ExtensionRuntimeHandle,
  ExtensionRuntimeMetadata,
  ExtensionStorage,
  GameScraperProvider,
  HostEventListener,
  HostEventTopic,
  KisakiApi,
  PersonScraperProvider,
  RpcValue,
  RuntimeInfo,
  SerializableValue,
  SettingsPanelContribution,
  ThemeContribution
} from '@kisaki/extension-api'
import { isExtensionEventTopic } from '@kisaki/extension-api'
import type { ExtensionRegistry, LoadedExtensionRuntime } from './extension-registry'
import type { ExtensionHostRpcServer } from './rpc-server'
import { HostDeeplinkContributions } from './contributions/deeplinks'
import { HostEntityMenuContributions } from './contributions/entity-menus'
import { HostScraperContributions } from './contributions/scrapers'
import { HostSettingsPanelContributions } from './contributions/settings-panels'
import { HostThemeContributions } from './contributions/themes'
import type { HostContributionScope } from './contributions/types'

interface ActiveExtensionScope {
  extensionId: string
  runtimeHandle: ExtensionRuntimeHandle
}

interface HostEventSubscriptionRecord {
  scope: ActiveExtensionScope
  once: boolean
  topic: HostEventTopic
  listener: HostEventListener<HostEventTopic>
}

interface ExtensionEventListenerRecord {
  scope: ActiveExtensionScope
  listener: ExtensionEventListener<ExtensionEventPayload>
}

interface ExtensionSdkBridge {
  readonly api: KisakiApi
  createLogger(scope: ActiveExtensionScope, extension: ExtensionRuntimeMetadata): ExtensionLogger
  createStorage(scope: ActiveExtensionScope): ExtensionStorage
  registerEntityMenu(contribution: EntityMenuContribution): Disposable
  registerSettingsPanel(contribution: SettingsPanelContribution): Disposable
  registerGameScraperProvider(provider: GameScraperProvider): Disposable
  registerPersonScraperProvider(provider: PersonScraperProvider): Disposable
  registerCompanyScraperProvider(provider: CompanyScraperProvider): Disposable
  registerCharacterScraperProvider(provider: CharacterScraperProvider): Disposable
  registerDeeplink(contribution: DeeplinkContribution): Disposable
  registerTheme(theme: ThemeContribution): Disposable
  asAbsolutePath(extensionPath: string, relativePath: string): string
}

interface ExtensionSdkBridgeStore {
  bridge: { readonly api: KisakiApi } | null
}

export interface ExtensionContextOptions {
  extension: ExtensionRuntimeMetadata
  runtimeHandle: ExtensionRuntimeHandle
  abortSignal: AbortSignal
}

const EXTENSION_SDK_BRIDGE_KEY = Symbol.for('kisaki.extensionSdkBridge')
const CONTRIBUTION_CLEANUP_REQUEST_OPTIONS = Object.freeze({ timeoutMs: 5_000 })

/**
 * Shared extension-host bridge that binds the public SDK root entry to the
 * currently executing runtime scope inside the utility process.
 */
export class ExtensionHostSdkBridge {
  private readonly executionScope = new AsyncLocalStorage<ActiveExtensionScope>()
  private readonly bridge: ExtensionSdkBridge
  private readonly entityMenus: HostEntityMenuContributions
  private readonly settingsPanels: HostSettingsPanelContributions
  private readonly scrapers: HostScraperContributions
  private readonly deeplinks: HostDeeplinkContributions
  private readonly themes: HostThemeContributions
  private readonly hostEventSubscriptions = new Map<string, HostEventSubscriptionRecord>()
  private readonly extensionEventListeners = new Map<
    ExtensionEventTopic,
    Map<string, ExtensionEventListenerRecord>
  >()
  private readonly pendingMainRequests = new Map<ExtensionRuntimeHandle, Set<Promise<void>>>()
  private readonly mainEventCleanup: () => void

  constructor(
    private readonly registry: ExtensionRegistry,
    private readonly rpc: ExtensionHostRpcServer
  ) {
    this.bridge = this.createBridge()
    const contributionOptions = {
      registry: this.registry,
      rpc: this.rpc,
      getRequestOptions: (scope: HostContributionScope) => this.getRequestOptions(scope),
      getCleanupRequestOptions: () => CONTRIBUTION_CLEANUP_REQUEST_OPTIONS,
      runInExtensionContext: <T>(
        runtimeOrScope: LoadedExtensionRuntime | HostContributionScope,
        callback: () => Promise<T> | T
      ) => this.runInExtensionContext(runtimeOrScope, callback),
      trackMainRequest: (scope: HostContributionScope, request: Promise<unknown>) => {
        this.trackMainRequest(scope, request)
      }
    }
    this.entityMenus = new HostEntityMenuContributions(contributionOptions)
    this.settingsPanels = new HostSettingsPanelContributions(contributionOptions)
    this.scrapers = new HostScraperContributions(contributionOptions)
    this.deeplinks = new HostDeeplinkContributions(contributionOptions)
    this.themes = new HostThemeContributions(contributionOptions)
    this.mainEventCleanup = this.rpc.onMainEvent('capabilities.events.host', (payload) =>
      this.handleHostEventNotification(payload)
    )
  }

  configure(): void {
    configureExtensionSdkBridge(this.bridge)
  }

  dispose(): void {
    this.mainEventCleanup()
    this.entityMenus.releaseAll()
    this.settingsPanels.releaseAll()
    this.scrapers.releaseAll()
    this.pendingMainRequests.clear()
    this.hostEventSubscriptions.clear()
    this.extensionEventListeners.clear()
    resetExtensionSdkBridge()
  }

  registerContributionRpcHandlers(): void {
    this.rpc.handle('entityMenus.resolve', (params, context) =>
      this.entityMenus.resolve(params, context.signal)
    )
    this.rpc.handle('entityMenus.invoke', (params, context) =>
      this.entityMenus.invoke(params, context.signal)
    )
    this.rpc.handle('settingsPanels.resolve', (params, context) =>
      this.settingsPanels.resolve(params, context.signal)
    )
    this.rpc.handle('settingsPanels.submit', (params, context) =>
      this.settingsPanels.submit(params, context.signal)
    )
    this.rpc.handle('settingsPanels.invoke', (params, context) =>
      this.settingsPanels.invoke(params, context.signal)
    )
    this.rpc.handle('deeplinks.handle', (params) => this.deeplinks.handle(params))
    this.rpc.handle('scrapers.games.search', (params) => this.scrapers.searchGames(params))
    this.rpc.handle('scrapers.games.resolve', (params) => this.scrapers.resolveGame(params))
    this.rpc.handle('scrapers.games.session.open', (params) =>
      this.scrapers.openGameSession(params)
    )
    this.rpc.handle('scrapers.games.session.get', (params) => this.scrapers.getGameSession(params))
    this.rpc.handle('scrapers.games.session.close', async (params) => {
      await this.scrapers.closeGameSession(params)
      return {}
    })
    this.rpc.handle('scrapers.persons.search', (params) => this.scrapers.searchPersons(params))
    this.rpc.handle('scrapers.persons.resolve', (params) => this.scrapers.resolvePerson(params))
    this.rpc.handle('scrapers.persons.session.open', (params) =>
      this.scrapers.openPersonSession(params)
    )
    this.rpc.handle('scrapers.persons.session.get', (params) =>
      this.scrapers.getPersonSession(params)
    )
    this.rpc.handle('scrapers.persons.session.close', async (params) => {
      await this.scrapers.closePersonSession(params)
      return {}
    })
    this.rpc.handle('scrapers.companies.search', (params) => this.scrapers.searchCompanies(params))
    this.rpc.handle('scrapers.companies.resolve', (params) => this.scrapers.resolveCompany(params))
    this.rpc.handle('scrapers.companies.session.open', (params) =>
      this.scrapers.openCompanySession(params)
    )
    this.rpc.handle('scrapers.companies.session.get', (params) =>
      this.scrapers.getCompanySession(params)
    )
    this.rpc.handle('scrapers.companies.session.close', async (params) => {
      await this.scrapers.closeCompanySession(params)
      return {}
    })
    this.rpc.handle('scrapers.characters.search', (params) =>
      this.scrapers.searchCharacters(params)
    )
    this.rpc.handle('scrapers.characters.resolve', (params) =>
      this.scrapers.resolveCharacter(params)
    )
    this.rpc.handle('scrapers.characters.session.open', (params) =>
      this.scrapers.openCharacterSession(params)
    )
    this.rpc.handle('scrapers.characters.session.get', (params) =>
      this.scrapers.getCharacterSession(params)
    )
    this.rpc.handle('scrapers.characters.session.close', async (params) => {
      await this.scrapers.closeCharacterSession(params)
      return {}
    })
  }

  async flushRuntime(runtimeHandle: ExtensionRuntimeHandle): Promise<void> {
    while (true) {
      const pending = this.pendingMainRequests.get(runtimeHandle)
      if (!pending || pending.size === 0) {
        return
      }

      await Promise.all([...pending])
    }
  }

  releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    this.entityMenus.releaseRuntime(runtimeHandle)
    this.settingsPanels.releaseRuntime(runtimeHandle)
    this.scrapers.releaseRuntime(runtimeHandle)
    this.pendingMainRequests.delete(runtimeHandle)
  }

  createExtensionContext(options: ExtensionContextOptions): {
    context: ExtensionContext
    subscriptions: DisposableStore
  } {
    const subscriptions = createDisposableStore()
    const scope: ActiveExtensionScope = {
      extensionId: options.extension.id,
      runtimeHandle: options.runtimeHandle
    }

    return {
      context: {
        extension: options.extension,
        logger: this.bridge.createLogger(scope, options.extension),
        storage: this.bridge.createStorage(scope),
        subscriptions,
        abortSignal: options.abortSignal,
        contributes: {
          entityMenus: createEntityMenuRegistrar(this.bridge, subscriptions),
          settingsPanels: createSettingsPanelRegistrar(this.bridge, subscriptions),
          scrapers: createScraperRegistrar(this.bridge, subscriptions),
          deeplinks: createDeeplinkRegistrar(this.bridge, subscriptions),
          themes: createThemeRegistrar(this.bridge, subscriptions)
        },
        asAbsolutePath: (relativePath: string) =>
          this.bridge.asAbsolutePath(options.extension.extensionPath, relativePath),
        registerDisposable: (disposable: Disposable) => {
          subscriptions.add(disposable)
        }
      },
      subscriptions
    }
  }

  runInExtensionContext<T>(
    runtimeOrScope: LoadedExtensionRuntime | ActiveExtensionScope,
    callback: () => Promise<T> | T
  ): Promise<T> | T {
    return this.executionScope.run(toScope(runtimeOrScope), callback)
  }

  private createBridge(): ExtensionSdkBridge {
    return {
      api: this.createApi(),
      createLogger: (scope, extension) => this.createLogger(scope, extension),
      createStorage: (scope) => this.createStorage(scope),
      registerEntityMenu: (contribution) => this.registerEntityMenu(contribution),
      registerSettingsPanel: (contribution) => this.registerSettingsPanel(contribution),
      registerGameScraperProvider: (provider) => this.registerGameScraperProvider(provider),
      registerPersonScraperProvider: (provider) => this.registerPersonScraperProvider(provider),
      registerCompanyScraperProvider: (provider) => this.registerCompanyScraperProvider(provider),
      registerCharacterScraperProvider: (provider) =>
        this.registerCharacterScraperProvider(provider),
      registerDeeplink: (contribution) => this.registerDeeplink(contribution),
      registerTheme: (theme) => this.registerTheme(theme),
      asAbsolutePath: (extensionPath, relativePath) =>
        resolveInsideExtension(extensionPath, relativePath)
    }
  }

  private createApi(): KisakiApi {
    const requestMain = <TResult>(method: string, params: Record<string, unknown>) => {
      const scope = this.requireCurrentScope()
      return this.rpc.requestMain(
        method as any,
        {
          runtimeHandle: scope.runtimeHandle,
          ...params
        } as any,
        this.getRequestOptions(scope)
      ) as Promise<TResult>
    }

    const createEntityNamespace = (prefix: string) => ({
      get: async (id: string) =>
        (await requestMain<{ entity: unknown }>(`${prefix}.get`, { id })).entity as any,
      list: async (query?: unknown) =>
        (await requestMain<{ items: readonly unknown[] }>(`${prefix}.list`, { query }))
          .items as any,
      create: async (input: unknown) =>
        (await requestMain<{ entity: unknown }>(`${prefix}.create`, { input })).entity as any,
      update: async (id: string, patch: unknown) =>
        (await requestMain<{ entity: unknown }>(`${prefix}.update`, { id, patch })).entity as any,
      remove: async (id: string) => {
        await requestMain(`${prefix}.remove`, { id })
      }
    })

    return {
      library: {
        games: createEntityNamespace('capabilities.library.games'),
        characters: createEntityNamespace('capabilities.library.characters'),
        persons: createEntityNamespace('capabilities.library.persons'),
        companies: createEntityNamespace('capabilities.library.companies'),
        collections: createEntityNamespace('capabilities.library.collections'),
        tags: createEntityNamespace('capabilities.library.tags'),
        relations: {
          list: async (query) =>
            (
              await requestMain<{ items: readonly unknown[] }>(
                'capabilities.library.relations.list',
                {
                  query
                }
              )
            ).items as any,
          create: async (input) =>
            (
              await requestMain<{ relation: unknown }>('capabilities.library.relations.create', {
                input
              })
            ).relation as any,
          update: async (selector, patch) =>
            (
              await requestMain<{ relation: unknown }>('capabilities.library.relations.update', {
                selector,
                patch
              })
            ).relation as any,
          remove: async (selector) => {
            await requestMain('capabilities.library.relations.remove', { selector })
          }
        },
        attachments: {
          list: async (entity) =>
            (
              await requestMain<{ items: readonly unknown[] }>(
                'capabilities.library.attachments.list',
                {
                  entity
                }
              )
            ).items as any,
          put: async (input) =>
            (
              await requestMain<{ attachment: unknown }>('capabilities.library.attachments.put', {
                input
              })
            ).attachment as any,
          remove: async (input) => {
            await requestMain('capabilities.library.attachments.remove', { input })
          }
        }
      },
      network: {
        request: async (input) =>
          (await requestMain<{ response: unknown }>('capabilities.network.request', { input }))
            .response as any,
        download: async (input) =>
          (await requestMain<{ result: unknown }>('capabilities.network.download', { input }))
            .result as any
      },
      notify: {
        success: async (title, options) =>
          (
            await requestMain<{ handle: unknown }>('capabilities.notify.show', {
              kind: 'success',
              title,
              options
            })
          ).handle as any,
        info: async (title, options) =>
          (
            await requestMain<{ handle: unknown }>('capabilities.notify.show', {
              kind: 'info',
              title,
              options
            })
          ).handle as any,
        warning: async (title, options) =>
          (
            await requestMain<{ handle: unknown }>('capabilities.notify.show', {
              kind: 'warning',
              title,
              options
            })
          ).handle as any,
        error: async (title, options) =>
          (
            await requestMain<{ handle: unknown }>('capabilities.notify.show', {
              kind: 'error',
              title,
              options
            })
          ).handle as any,
        loading: async (title, options) =>
          (
            await requestMain<{ handle: unknown }>('capabilities.notify.show', {
              kind: 'loading',
              title,
              options
            })
          ).handle as any,
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
        on: async (topic, listener) => this.subscribeHostEvent(topic, listener, false),
        once: async (topic, listener) => this.subscribeHostEvent(topic, listener, true),
        onExtension: async (topic, listener) => this.subscribeExtensionEvent(topic, listener),
        emit: async (topic, payload) => this.emitExtensionEvent(topic, payload)
      },
      runtime: {
        getInfo: async () => {
          return (await requestMain<{ info: RuntimeInfo }>('capabilities.runtime.getInfo', {})).info
        },
        delay: async (ms: number) => {
          await new Promise((resolve) => setTimeout(resolve, ms))
        }
      }
    }
  }

  private createLogger(
    scope: ActiveExtensionScope,
    extension: ExtensionRuntimeMetadata
  ): ExtensionLogger {
    const logWithLevel = (
      level: 'debug' | 'info' | 'warn' | 'error',
      message: string,
      args: unknown[]
    ) => {
      void this.rpc
        .requestMain(
          'bridge.logger.log',
          {
            runtimeHandle: scope.runtimeHandle,
            level,
            message,
            args: args.map((value) => toRpcValue(value))
          },
          this.getRequestOptions(scope)
        )
        .catch((error) => {
          console.warn(`[ExtensionHost][${extension.id}] Failed to forward ${level} log:`, error)
        })
    }

    return {
      debug: (message, ...args) => logWithLevel('debug', message, args),
      info: (message, ...args) => logWithLevel('info', message, args),
      warn: (message, ...args) => logWithLevel('warn', message, args),
      error: (message, ...args) => logWithLevel('error', message, args)
    }
  }

  private createStorage(scope: ActiveExtensionScope): ExtensionStorage {
    const rpc = this.rpc
    const getRequestOptions = () => this.getRequestOptions(scope)

    return {
      get: async <T>(key: string, fallback: T): Promise<T> => {
        const result = await rpc.requestMain(
          'bridge.storage.get',
          {
            runtimeHandle: scope.runtimeHandle,
            key,
            fallback: toSerializableValue(fallback, 'storage fallback')
          },
          getRequestOptions()
        )

        return result.value as T
      },
      set: async <T>(key: string, value: T): Promise<void> => {
        await rpc.requestMain(
          'bridge.storage.set',
          {
            runtimeHandle: scope.runtimeHandle,
            key,
            value: toSerializableValue(value, 'storage value')
          },
          getRequestOptions()
        )
      },
      delete: async (key: string): Promise<void> => {
        await rpc.requestMain(
          'bridge.storage.delete',
          {
            runtimeHandle: scope.runtimeHandle,
            key
          },
          getRequestOptions()
        )
      },
      listKeys: async (prefix?: string): Promise<readonly string[]> => {
        const result = await rpc.requestMain(
          'bridge.storage.listKeys',
          {
            runtimeHandle: scope.runtimeHandle,
            prefix
          },
          getRequestOptions()
        )

        return result.keys
      }
    }
  }

  private registerEntityMenu(contribution: EntityMenuContribution): Disposable {
    return this.entityMenus.register(this.requireCurrentScope(), contribution)
  }

  private registerSettingsPanel(contribution: SettingsPanelContribution): Disposable {
    return this.settingsPanels.register(this.requireCurrentScope(), contribution)
  }

  private registerGameScraperProvider(provider: GameScraperProvider): Disposable {
    return this.scrapers.registerGameProvider(this.requireCurrentScope(), provider)
  }

  private registerPersonScraperProvider(provider: PersonScraperProvider): Disposable {
    return this.scrapers.registerPersonProvider(this.requireCurrentScope(), provider)
  }

  private registerCompanyScraperProvider(provider: CompanyScraperProvider): Disposable {
    return this.scrapers.registerCompanyProvider(this.requireCurrentScope(), provider)
  }

  private registerCharacterScraperProvider(provider: CharacterScraperProvider): Disposable {
    return this.scrapers.registerCharacterProvider(this.requireCurrentScope(), provider)
  }

  private registerDeeplink(contribution: DeeplinkContribution): Disposable {
    return this.deeplinks.register(this.requireCurrentScope(), contribution)
  }

  private registerTheme(theme: ThemeContribution): Disposable {
    return this.themes.register(this.requireCurrentScope(), theme)
  }

  private async subscribeHostEvent<K extends HostEventTopic>(
    topic: K,
    listener: HostEventListener<K>,
    once: boolean
  ): Promise<Disposable> {
    const scope = this.requireCurrentScope()
    const subscriptionId = randomUUID()

    this.hostEventSubscriptions.set(subscriptionId, {
      scope,
      topic,
      once,
      listener: listener as HostEventListener<HostEventTopic>
    })

    try {
      await this.rpc.requestMain(
        'capabilities.events.subscribeHost',
        {
          runtimeHandle: scope.runtimeHandle,
          subscriptionId,
          topic
        },
        this.getRequestOptions(scope)
      )
    } catch (error) {
      this.hostEventSubscriptions.delete(subscriptionId)
      throw error
    }

    const disposable = createDisposable(async () => {
      await this.disposeHostEventSubscription(subscriptionId, true)
    })
    this.registry.getByRuntimeHandle(scope.runtimeHandle)?.subscriptions.add(disposable)
    return disposable
  }

  private async disposeHostEventSubscription(
    subscriptionId: string,
    notifyMain: boolean
  ): Promise<void> {
    const record = this.hostEventSubscriptions.get(subscriptionId)
    if (!record) {
      return
    }

    this.hostEventSubscriptions.delete(subscriptionId)

    if (!notifyMain) {
      return
    }

    await this.rpc.requestMain(
      'capabilities.events.unsubscribeHost',
      {
        runtimeHandle: record.scope.runtimeHandle,
        subscriptionId,
        topic: record.topic
      },
      { timeoutMs: 5_000 }
    )
  }

  private async handleHostEventNotification(payload: unknown): Promise<void> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return
    }

    const notification = payload as {
      subscriptionId?: string
      topic?: HostEventTopic
      payload?: unknown
    }
    if (typeof notification.subscriptionId !== 'string') {
      return
    }

    const record = this.hostEventSubscriptions.get(notification.subscriptionId)
    if (!record) {
      return
    }

    try {
      await this.runInExtensionContext(record.scope, () =>
        Promise.resolve(record.listener(notification.payload as never))
      )
    } catch (error) {
      console.warn(
        `[ExtensionHost][${record.scope.extensionId}] Host event listener "${record.topic}" failed:`,
        error
      )
    } finally {
      if (record.once) {
        await this.disposeHostEventSubscription(notification.subscriptionId, true).catch(
          (error) => {
            console.warn(
              `[ExtensionHost][${record.scope.extensionId}] Failed to dispose host event subscription "${record.topic}":`,
              error
            )
          }
        )
      }
    }
  }

  private async subscribeExtensionEvent<TPayload extends ExtensionEventPayload>(
    topic: ExtensionEventTopic,
    listener: ExtensionEventListener<TPayload>
  ): Promise<Disposable> {
    if (!isExtensionEventTopic(topic)) {
      throw new Error(`Invalid extension event topic "${topic}"`)
    }

    const scope = this.requireCurrentScope()
    const subscriptionId = randomUUID()
    let listeners = this.extensionEventListeners.get(topic)
    if (!listeners) {
      listeners = new Map()
      this.extensionEventListeners.set(topic, listeners)
    }

    listeners.set(subscriptionId, {
      scope,
      listener: listener as ExtensionEventListener<ExtensionEventPayload>
    })

    const disposable = createDisposable(() => {
      const scopedListeners = this.extensionEventListeners.get(topic)
      scopedListeners?.delete(subscriptionId)
      if (scopedListeners && scopedListeners.size === 0) {
        this.extensionEventListeners.delete(topic)
      }
    })
    this.registry.getByRuntimeHandle(scope.runtimeHandle)?.subscriptions.add(disposable)
    return disposable
  }

  private async emitExtensionEvent<TPayload extends ExtensionEventPayload>(
    topic: ExtensionEventTopic,
    payload: TPayload
  ): Promise<void> {
    if (!isExtensionEventTopic(topic)) {
      throw new Error(`Invalid extension event topic "${topic}"`)
    }

    const scope = this.requireCurrentScope()
    const expectedPrefix = `ext.${scope.extensionId}.`
    if (!topic.startsWith(expectedPrefix)) {
      throw new Error(
        `Extension "${scope.extensionId}" can only emit namespaced topics under "${expectedPrefix}".`
      )
    }

    const normalizedPayload = toSerializableRecord(payload, 'extension event payload')
    const listeners = this.extensionEventListeners.get(topic)
    if (!listeners || listeners.size === 0) {
      return
    }

    for (const record of listeners.values()) {
      try {
        await this.runInExtensionContext(record.scope, () =>
          Promise.resolve(record.listener(normalizedPayload))
        )
      } catch (error) {
        console.warn(
          `[ExtensionHost][${record.scope.extensionId}] Extension event listener "${topic}" failed:`,
          error
        )
      }
    }
  }

  private requireCurrentScope(): ActiveExtensionScope {
    const scope = this.executionScope.getStore()
    if (!scope?.runtimeHandle) {
      throw new Error(
        'The Kisaki extension SDK bridge was used outside an active extension execution scope.'
      )
    }

    return scope
  }

  private getRequestOptions(scope: ActiveExtensionScope): { signal?: AbortSignal } | undefined {
    const signal = this.registry.getByRuntimeHandle(scope.runtimeHandle)?.abortController.signal
    return signal ? { signal } : undefined
  }

  private trackMainRequest(scope: HostContributionScope, request: Promise<unknown>): void {
    let pending = this.pendingMainRequests.get(scope.runtimeHandle)
    if (!pending) {
      pending = new Set()
      this.pendingMainRequests.set(scope.runtimeHandle, pending)
    }

    const tracked = Promise.resolve(request)
      .then(() => undefined)
      .finally(() => {
        pending?.delete(tracked)
        if (pending?.size === 0) {
          this.pendingMainRequests.delete(scope.runtimeHandle)
        }
      })

    pending.add(tracked)
    void tracked.catch((error) => {
      console.warn(
        `[ExtensionHost][${scope.extensionId}] Failed to synchronize contribution registry:`,
        error
      )
    })
  }
}

function getBridgeStore(): ExtensionSdkBridgeStore {
  const globalObject = globalThis as typeof globalThis &
    Record<symbol, ExtensionSdkBridgeStore | undefined>
  let store = globalObject[EXTENSION_SDK_BRIDGE_KEY]

  if (!store) {
    store = { bridge: null }
    globalObject[EXTENSION_SDK_BRIDGE_KEY] = store
  }

  return store
}

function configureExtensionSdkBridge(bridge: { readonly api: KisakiApi }): void {
  const store = getBridgeStore()

  if (store.bridge && store.bridge !== bridge) {
    throw new Error(
      'The Kisaki extension SDK bridge has already been configured for this process. Reset it before replacing the bridge instance.'
    )
  }

  store.bridge = bridge
}

function resetExtensionSdkBridge(): void {
  getBridgeStore().bridge = null
}

class DisposableStoreImpl implements DisposableStore {
  private readonly disposables = new Set<Disposable>()

  get size(): number {
    return this.disposables.size
  }

  add<T extends Disposable>(disposable: T): T {
    this.disposables.add(disposable)
    return disposable
  }

  delete(disposable: Disposable): boolean {
    return this.disposables.delete(disposable)
  }

  async clear(): Promise<void> {
    const disposables = [...this.disposables]
    this.disposables.clear()
    const errors: unknown[] = []

    for (const disposable of disposables.reverse()) {
      try {
        await disposable.dispose()
      } catch (error) {
        errors.push(error)
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, 'One or more extension disposables failed to clean up.')
    }
  }

  async dispose(): Promise<void> {
    await this.clear()
  }
}

function createDisposableStore(): DisposableStore {
  return new DisposableStoreImpl()
}

function createEntityMenuRegistrar(bridge: ExtensionSdkBridge, subscriptions: DisposableStore) {
  return {
    register(contribution: EntityMenuContribution) {
      const disposable = bridge.registerEntityMenu(contribution)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

function createSettingsPanelRegistrar(bridge: ExtensionSdkBridge, subscriptions: DisposableStore) {
  return {
    register(contribution: SettingsPanelContribution) {
      const disposable = bridge.registerSettingsPanel(contribution)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

function createScraperRegistrar(bridge: ExtensionSdkBridge, subscriptions: DisposableStore) {
  return {
    registerGameProvider(provider: GameScraperProvider) {
      const disposable = bridge.registerGameScraperProvider(provider)
      subscriptions.add(disposable)
      return disposable
    },
    registerPersonProvider(provider: PersonScraperProvider) {
      const disposable = bridge.registerPersonScraperProvider(provider)
      subscriptions.add(disposable)
      return disposable
    },
    registerCompanyProvider(provider: CompanyScraperProvider) {
      const disposable = bridge.registerCompanyScraperProvider(provider)
      subscriptions.add(disposable)
      return disposable
    },
    registerCharacterProvider(provider: CharacterScraperProvider) {
      const disposable = bridge.registerCharacterScraperProvider(provider)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

function createDeeplinkRegistrar(bridge: ExtensionSdkBridge, subscriptions: DisposableStore) {
  return {
    register(contribution: DeeplinkContribution) {
      const disposable = bridge.registerDeeplink(contribution)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

function createThemeRegistrar(bridge: ExtensionSdkBridge, subscriptions: DisposableStore) {
  return {
    register(theme: ThemeContribution) {
      const disposable = bridge.registerTheme(theme)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

function toScope(
  runtimeOrScope: LoadedExtensionRuntime | ActiveExtensionScope
): ActiveExtensionScope {
  if ('metadata' in runtimeOrScope) {
    return {
      extensionId: runtimeOrScope.metadata.id,
      runtimeHandle: runtimeOrScope.runtimeHandle
    }
  }

  return runtimeOrScope
}

function createDisposable(dispose: () => Promise<void> | void): Disposable {
  return { dispose }
}

function resolveInsideExtension(extensionPath: string, relativePath: string): string {
  const absolutePath = path.resolve(extensionPath, relativePath)
  const relative = path.relative(extensionPath, absolutePath)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Extension paths must stay within the extension directory')
  }

  return absolutePath
}

function toSerializableValue(
  value: unknown,
  label: string,
  seen = new Set<object>()
): SerializableValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new Error(`${label} must not contain circular references`)
    }

    seen.add(value)
    const items = value.map((entry) => toSerializableValue(entry, label, seen))
    seen.delete(value)
    return items
  }

  if (value && typeof value === 'object') {
    if (seen.has(value)) {
      throw new Error(`${label} must not contain circular references`)
    }

    seen.add(value)
    const result: Record<string, SerializableValue> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = toSerializableValue(entry, label, seen)
    }
    seen.delete(value)
    return result
  }

  throw new Error(`${label} must be JSON-serializable`)
}

function toSerializableRecord(value: unknown, label: string): Record<string, SerializableValue> {
  const normalized = toSerializableValue(value, label)
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
    throw new Error(`${label} must be an object`)
  }

  return normalized as Record<string, SerializableValue>
}

function toRpcValue(value: unknown): RpcValue {
  if (value instanceof Uint8Array) {
    return value
  }

  if (value instanceof Error) {
    const serializedError: Record<string, string> = {
      name: value.name,
      message: value.message
    }

    if (value.stack) {
      serializedError.stack = value.stack
    }

    return serializedError
  }

  try {
    return toSerializableValue(value, 'log argument')
  } catch {
    return String(value)
  }
}
