import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import type {
  CharacterScraperProvider,
  CompanyScraperProvider,
  CommandContribution,
  DeeplinkContribution,
  DeeplinkRegistrationHandle,
  Disposable,
  DisposableStore,
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
  KisakiApi,
  MenuContribution,
  MenuDomain,
  MenuInputFor,
  MenuRegistration,
  MenuScope,
  PersonScraperProvider,
  RpcParams,
  RpcResult,
  SettingsContribution,
  SettingsRegistration,
  ThemeContribution
} from '@kisaki/extension-api'
import { isExtensionEventTopic } from '@kisaki/extension-api'
import type { ExtensionRegistry, LoadedExtensionRuntime } from '../extension-registry'
import type { ExtensionHostRpcServer } from '../rpc-server'
import { HostCommandContributions } from '../contributions/commands'
import { HostDeeplinkContributions } from '../contributions/deeplinks'
import { HostMenuContributions } from '../contributions/menus'
import { HostScraperContributions, MAIN_TO_HOST_SCRAPER_RPC } from '../contributions/scrapers'
import { HostSettingsContributions } from '../contributions/settings'
import { HostThemeContributions } from '../contributions/themes'
import type { HostContributionScope } from '../contributions/types'
import { createDisposable, createDisposableStore } from './disposables'
import {
  createKisakiApi,
  createScopeCapturingKisakiApi,
  type KisakiApiBridgeHooks
} from './kisaki-api'
import { createExtensionLogger } from './logger'
import { resolveInsideExtension } from './utils/paths'
import {
  createDeeplinkRegistrar,
  createCommandRegistrar,
  createMenuRegistrar,
  createScraperRegistrar,
  createSettingsRegistrar,
  createThemeRegistrar
} from './registrars'
import { toSerializableRecord } from './utils/serialization'
import { createExtensionStorage } from './storage'
import { createExtensionSecrets } from './secrets'
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
  private readonly menus: HostMenuContributions
  private readonly settings: HostSettingsContributions
  private readonly scrapers: HostScraperContributions
  private readonly deeplinks: HostDeeplinkContributions
  private readonly themes: HostThemeContributions
  private readonly commands: HostCommandContributions
  private readonly hostEventSubscriptions = new Map<string, HostEventSubscriptionRecord>()
  private readonly extensionEventListeners = new Map<
    ExtensionEventTopic,
    Map<string, ExtensionEventListenerRecord>
  >()
  private readonly scopedApis = new Map<ExtensionRuntimeHandle, KisakiApi>()
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
    this.menus = new HostMenuContributions(contributionOptions)
    this.settings = new HostSettingsContributions(contributionOptions)
    this.scrapers = new HostScraperContributions(contributionOptions)
    this.deeplinks = new HostDeeplinkContributions(contributionOptions)
    this.themes = new HostThemeContributions(contributionOptions)
    this.commands = new HostCommandContributions(contributionOptions)
    this.mainEventCleanup = this.rpc.onMainEvent('capabilities.events.host', (payload) =>
      this.handleHostEventNotification(payload)
    )
  }

  configure(): void {
    configureExtensionSdkBridge(this.bridge)
  }

  async dispose(): Promise<void> {
    this.mainEventCleanup()
    this.menus.releaseAll()
    this.settings.releaseAll()
    await this.scrapers.releaseAll()
    this.deeplinks.releaseAll()
    this.themes.releaseAll()
    this.commands.releaseAll()
    this.pendingMainRequests.clear()
    this.scopedApis.clear()
    this.hostEventSubscriptions.clear()
    this.extensionEventListeners.clear()
    resetExtensionSdkBridge()
  }

  registerContributionRpcHandlers(): void {
    this.rpc.handle('contributions.menus.resolve', (params, context) =>
      this.menus.resolve(params, context.signal)
    )
    this.rpc.handle('contributions.menus.invoke', (params, context) =>
      this.menus.invoke(params, context.signal)
    )
    this.rpc.handle('contributions.menus.release', (params) => {
      this.menus.release(params)
      return {}
    })
    this.rpc.handle('contributions.settings.open', (params, context) =>
      this.settings.open(params, context.signal)
    )
    this.rpc.handle('contributions.settings.refresh', (params, context) =>
      this.settings.refresh(params, context.signal)
    )
    this.rpc.handle('contributions.settings.submit', (params, context) =>
      this.settings.submit(params, context.signal)
    )
    this.rpc.handle('contributions.settings.invoke', (params, context) =>
      this.settings.invoke(params, context.signal)
    )
    this.rpc.handle('contributions.settings.release', (params) => {
      this.settings.release(params)
      return {}
    })
    this.rpc.handle('contributions.deeplinks.handle', (params) => this.deeplinks.handle(params))
    this.rpc.handle('contributions.commands.execute', (params, context) =>
      this.commands.execute(params, context.signal)
    )
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
    this.menus.releaseRuntime(runtimeHandle)
    this.settings.releaseRuntime(runtimeHandle)
    await this.scrapers.releaseRuntime(runtimeHandle)
    this.deeplinks.releaseRuntime(runtimeHandle)
    this.themes.releaseRuntime(runtimeHandle)
    this.commands.releaseRuntime(runtimeHandle)
    await this.disposeHostEventSubscriptionsForRuntime(runtimeHandle)
    this.disposeExtensionEventListenersForRuntime(runtimeHandle)
    this.scopedApis.delete(runtimeHandle)
    this.pendingMainRequests.delete(runtimeHandle)
  }

  createExtensionContext(options: ExtensionContextOptions): {
    context: ExtensionContext
    subscriptions: DisposableStore
    scope: ActiveExtensionScope
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
        secrets: this.bridge.createSecrets(scope),
        subscriptions,
        abortSignal: options.abortSignal,
        contributions: {
          commands: createCommandRegistrar(this.bridge, subscriptions, scope),
          menus: createMenuRegistrar(this.bridge, subscriptions, scope),
          settings: createSettingsRegistrar(this.bridge, subscriptions, scope),
          scrapers: createScraperRegistrar(this.bridge, subscriptions, scope),
          deeplinks: createDeeplinkRegistrar(this.bridge, subscriptions, scope),
          themes: createThemeRegistrar(this.bridge, subscriptions, scope)
        },
        asAbsolutePath: (relativePath: string) =>
          this.bridge.asAbsolutePath(options.extension.extensionPath, relativePath),
        registerDisposable: (disposable: Disposable) => {
          subscriptions.add(disposable)
        }
      },
      subscriptions,
      scope
    }
  }

  runInExtensionContext<T>(
    runtimeOrScope: LoadedExtensionRuntime | ActiveExtensionScope,
    callback: () => Promise<T> | T
  ): Promise<T> | T {
    return this.executionScope.run(toScope(runtimeOrScope), callback)
  }

  private createBridge(): ExtensionSdkBridge {
    const hooks = this.createKisakiApiHooks()

    return {
      api: createScopeCapturingKisakiApi(hooks, (scope) => this.getScopedApi(scope, hooks)),
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
      createSecrets: (scope) =>
        createExtensionSecrets({
          scope,
          rpc: this.rpc,
          getRequestOptions: (requestScope) => this.getRequestOptions(requestScope)
        }),
      registerCommand: (scope, command) => this.registerCommand(scope, command),
      registerMenu: (scope, domain, menuScope, contribution) =>
        this.registerMenu(scope, domain, menuScope, contribution),
      registerSettings: (scope, contribution) => this.registerSettings(scope, contribution),
      registerGameScraperProvider: (scope, provider) =>
        this.registerGameScraperProvider(scope, provider),
      registerPersonScraperProvider: (scope, provider) =>
        this.registerPersonScraperProvider(scope, provider),
      registerCompanyScraperProvider: (scope, provider) =>
        this.registerCompanyScraperProvider(scope, provider),
      registerCharacterScraperProvider: (scope, provider) =>
        this.registerCharacterScraperProvider(scope, provider),
      registerDeeplink: (scope, contribution) => this.registerDeeplink(scope, contribution),
      registerTheme: (scope, theme) => this.registerTheme(scope, theme),
      asAbsolutePath: (extensionPath, relativePath) =>
        resolveInsideExtension(extensionPath, relativePath)
    }
  }

  private createKisakiApiHooks(): KisakiApiBridgeHooks {
    return {
      requireCurrentScope: () => this.requireCurrentScope(),
      requestMain: (scope, method, params) => this.requestMain(scope, method, params),
      subscribeHostEvent: (scope, topic, listener, once) =>
        this.subscribeHostEvent(scope, topic, listener, once),
      subscribeExtensionEvent: (scope, topic, listener) =>
        this.subscribeExtensionEvent(scope, topic, listener),
      emitExtensionEvent: (scope, topic, payload) => this.emitExtensionEvent(scope, topic, payload)
    }
  }

  private getScopedApi(scope: ActiveExtensionScope, hooks: KisakiApiBridgeHooks): KisakiApi {
    const existing = this.scopedApis.get(scope.runtimeHandle)
    if (existing) {
      return existing
    }

    const api = createKisakiApi(hooks, { ...scope })
    this.scopedApis.set(scope.runtimeHandle, api)
    return api
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

  private async registerCommand(
    scope: ActiveExtensionScope,
    command: CommandContribution
  ): Promise<Disposable> {
    return this.commands.register(scope, command)
  }

  private registerMenu<TDomain extends MenuDomain, TScope extends MenuScope<TDomain>>(
    scope: ActiveExtensionScope,
    domain: TDomain,
    menuScope: TScope,
    contribution: MenuContribution<MenuInputFor<TDomain, TScope>>
  ): MenuRegistration {
    return this.menus.register(scope, domain, menuScope, contribution)
  }

  private registerSettings(
    scope: ActiveExtensionScope,
    contribution: SettingsContribution<any, any>
  ): SettingsRegistration {
    return this.settings.register(scope, contribution)
  }

  private registerGameScraperProvider(
    scope: ActiveExtensionScope,
    provider: GameScraperProvider
  ): Disposable {
    return this.scrapers.registerGameProvider(scope, provider)
  }

  private registerPersonScraperProvider(
    scope: ActiveExtensionScope,
    provider: PersonScraperProvider
  ): Disposable {
    return this.scrapers.registerPersonProvider(scope, provider)
  }

  private registerCompanyScraperProvider(
    scope: ActiveExtensionScope,
    provider: CompanyScraperProvider
  ): Disposable {
    return this.scrapers.registerCompanyProvider(scope, provider)
  }

  private registerCharacterScraperProvider(
    scope: ActiveExtensionScope,
    provider: CharacterScraperProvider
  ): Disposable {
    return this.scrapers.registerCharacterProvider(scope, provider)
  }

  private registerDeeplink(
    scope: ActiveExtensionScope,
    contribution: DeeplinkContribution
  ): DeeplinkRegistrationHandle {
    return this.deeplinks.register(scope, contribution)
  }

  private registerTheme(scope: ActiveExtensionScope, theme: ThemeContribution): Disposable {
    return this.themes.register(scope, theme)
  }

  private async subscribeHostEvent<K extends HostEventTopic>(
    scope: ActiveExtensionScope,
    topic: K,
    listener: HostEventListener<K>,
    once: boolean
  ): Promise<Disposable> {
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

  private async disposeHostEventSubscriptionsForRuntime(
    runtimeHandle: ExtensionRuntimeHandle
  ): Promise<void> {
    const subscriptionIds = [...this.hostEventSubscriptions]
      .filter(([, record]) => record.scope.runtimeHandle === runtimeHandle)
      .map(([subscriptionId]) => subscriptionId)

    await Promise.all(
      subscriptionIds.map((subscriptionId) =>
        this.disposeHostEventSubscription(subscriptionId, true).catch((error) => {
          console.warn(
            `[ExtensionHost] Failed to dispose host event subscription "${subscriptionId}" during runtime cleanup:`,
            error
          )
        })
      )
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
    scope: ActiveExtensionScope,
    topic: ExtensionEventTopic,
    listener: ExtensionEventListener<TPayload>
  ): Promise<Disposable> {
    if (!isExtensionEventTopic(topic)) {
      throw new Error(`Invalid extension event topic "${topic}"`)
    }

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

  private disposeExtensionEventListenersForRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    for (const [topic, listeners] of [...this.extensionEventListeners]) {
      for (const [subscriptionId, record] of [...listeners]) {
        if (record.scope.runtimeHandle === runtimeHandle) {
          listeners.delete(subscriptionId)
        }
      }

      if (listeners.size === 0) {
        this.extensionEventListeners.delete(topic)
      }
    }
  }

  private async emitExtensionEvent<TPayload extends ExtensionEventPayload>(
    scope: ActiveExtensionScope,
    topic: ExtensionEventTopic,
    payload: TPayload
  ): Promise<void> {
    if (!isExtensionEventTopic(topic)) {
      throw new Error(`Invalid extension event topic "${topic}"`)
    }

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
