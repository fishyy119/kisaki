import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
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
  ExtensionRuntimeHandle,
  GameScraperProvider,
  HostEventListener,
  HostEventTopic,
  HostToMainRpcMethod,
  HostToMainRpcRequestMap,
  PersonScraperProvider,
  RpcParams,
  RpcResult,
  SettingsPanelContribution,
  ThemeContribution
} from '@kisaki/extension-api'
import { isExtensionEventTopic } from '@kisaki/extension-api'
import type { ExtensionRegistry, LoadedExtensionRuntime } from '../extension-registry'
import type { ExtensionHostRpcServer } from '../rpc-server'
import { HostDeeplinkContributions } from '../contributions/deeplinks'
import { HostEntityMenuContributions } from '../contributions/entity-menus'
import { HostScraperContributions, MAIN_TO_HOST_SCRAPER_RPC } from '../contributions/scrapers'
import { HostSettingsPanelContributions } from '../contributions/settings-panels'
import { HostThemeContributions } from '../contributions/themes'
import type { HostContributionScope } from '../contributions/types'
import { createDisposable, createDisposableStore } from './disposables'
import { createKisakiApi } from './kisaki-api'
import { createExtensionLogger } from './logger'
import { resolveInsideExtension } from './utils/paths'
import {
  createDeeplinkRegistrar,
  createEntityMenuRegistrar,
  createScraperRegistrar,
  createSettingsPanelRegistrar,
  createThemeRegistrar
} from './registrars'
import { toSerializableRecord } from './utils/serialization'
import { createExtensionStorage } from './storage'
import { configureExtensionSdkBridge, resetExtensionSdkBridge } from './store'
import type {
  ActiveExtensionScope,
  ExtensionEventListenerRecord,
  ExtensionSdkBridge,
  HostEventSubscriptionRecord
} from './types'
import type { ExtensionContextOptions } from './types'

const CONTRIBUTION_CLEANUP_REQUEST_OPTIONS = Object.freeze({ timeoutMs: 5_000 })

type ScopedHostToMainRpcParams<K extends HostToMainRpcMethod> = Omit<
  RpcParams<HostToMainRpcRequestMap, K>,
  'runtimeHandle'
>

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
    this.deeplinks.releaseAll()
    this.themes.releaseAll()
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
    this.rpc.handle('entityMenus.session.release', (params) => {
      this.entityMenus.releaseSession(params)
      return {}
    })
    this.rpc.handle('settingsPanels.resolve', (params, context) =>
      this.settingsPanels.resolve(params, context.signal)
    )
    this.rpc.handle('settingsPanels.submit', (params, context) =>
      this.settingsPanels.submit(params, context.signal)
    )
    this.rpc.handle('settingsPanels.invoke', (params, context) =>
      this.settingsPanels.invoke(params, context.signal)
    )
    this.rpc.handle('settingsPanels.session.release', (params) => {
      this.settingsPanels.releaseSession(params)
      return {}
    })
    this.rpc.handle('deeplinks.handle', (params) => this.deeplinks.handle(params))
    this.registerScraperRpcHandlers()
  }

  private registerScraperRpcHandlers(): void {
    const games = MAIN_TO_HOST_SCRAPER_RPC.games.methods
    this.rpc.handle(games.search, (params) => this.scrapers.searchGames(params))
    this.rpc.handle(games.resolve, (params) => this.scrapers.resolveGame(params))
    this.rpc.handle(games.open, (params) => this.scrapers.openGameSession(params))
    this.rpc.handle(games.get, (params) => this.scrapers.getGameSession(params))
    this.rpc.handle(games.close, async (params) => {
      await this.scrapers.closeGameSession(params)
      return {}
    })

    const persons = MAIN_TO_HOST_SCRAPER_RPC.persons.methods
    this.rpc.handle(persons.search, (params) => this.scrapers.searchPersons(params))
    this.rpc.handle(persons.resolve, (params) => this.scrapers.resolvePerson(params))
    this.rpc.handle(persons.open, (params) => this.scrapers.openPersonSession(params))
    this.rpc.handle(persons.get, (params) => this.scrapers.getPersonSession(params))
    this.rpc.handle(persons.close, async (params) => {
      await this.scrapers.closePersonSession(params)
      return {}
    })

    const companies = MAIN_TO_HOST_SCRAPER_RPC.companies.methods
    this.rpc.handle(companies.search, (params) => this.scrapers.searchCompanies(params))
    this.rpc.handle(companies.resolve, (params) => this.scrapers.resolveCompany(params))
    this.rpc.handle(companies.open, (params) => this.scrapers.openCompanySession(params))
    this.rpc.handle(companies.get, (params) => this.scrapers.getCompanySession(params))
    this.rpc.handle(companies.close, async (params) => {
      await this.scrapers.closeCompanySession(params)
      return {}
    })

    const characters = MAIN_TO_HOST_SCRAPER_RPC.characters.methods
    this.rpc.handle(characters.search, (params) => this.scrapers.searchCharacters(params))
    this.rpc.handle(characters.resolve, (params) => this.scrapers.resolveCharacter(params))
    this.rpc.handle(characters.open, (params) => this.scrapers.openCharacterSession(params))
    this.rpc.handle(characters.get, (params) => this.scrapers.getCharacterSession(params))
    this.rpc.handle(characters.close, async (params) => {
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

  async releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): Promise<void> {
    this.entityMenus.releaseRuntime(runtimeHandle)
    this.settingsPanels.releaseRuntime(runtimeHandle)
    await this.scrapers.releaseRuntime(runtimeHandle)
    this.deeplinks.releaseRuntime(runtimeHandle)
    this.themes.releaseRuntime(runtimeHandle)
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
      api: createKisakiApi({
        requireCurrentScope: () => this.requireCurrentScope(),
        requestMain: (scope, method, params) => this.requestMain(scope, method, params),
        subscribeHostEvent: (topic, listener, once) =>
          this.subscribeHostEvent(topic, listener, once),
        subscribeExtensionEvent: (topic, listener) => this.subscribeExtensionEvent(topic, listener),
        emitExtensionEvent: (topic, payload) => this.emitExtensionEvent(topic, payload)
      }),
      createLogger: (scope, extension) =>
        createExtensionLogger({
          scope,
          extension,
          rpc: this.rpc,
          getRequestOptions: (requestScope) => this.getRequestOptions(requestScope)
        }),
      createStorage: (scope) =>
        createExtensionStorage({
          scope,
          rpc: this.rpc,
          getRequestOptions: (requestScope) => this.getRequestOptions(requestScope)
        }),
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

  private requestMain<K extends HostToMainRpcMethod>(
    scope: ActiveExtensionScope,
    method: K,
    params: ScopedHostToMainRpcParams<K>
  ): Promise<RpcResult<HostToMainRpcRequestMap, K>> {
    return this.rpc.requestMain(
      method,
      {
        runtimeHandle: scope.runtimeHandle,
        ...params
      } as RpcParams<HostToMainRpcRequestMap, K>,
      this.getRequestOptions(scope)
    )
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
