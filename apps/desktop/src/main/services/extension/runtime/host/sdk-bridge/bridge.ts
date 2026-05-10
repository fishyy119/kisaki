import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import type {
  CommandRegistration,
  CommandContribution,
  DeeplinkRouteContribution,
  DeeplinkRouteRegistration,
  Disposable,
  DisposableStore,
  EntityMenuContribution,
  EntityMenuDomain,
  EntityMenuInputFor,
  EntityMenuRegistration,
  EntityMenuScope,
  ExtensionContext,
  ExtensionEventListener,
  ExtensionEventPayload,
  ExtensionEventTopic,
  ExtensionRuntimeDiagnostic,
  ExtensionRuntimeHandle,
  HostEventListener,
  HostEventTopic,
  HostToMainRpcMethod,
  HostToMainRpcRequestMap,
  KisakiApi,
  ScraperMediaType,
  ScraperProviderRegistration,
  RpcParams,
  RpcResult,
  SettingsPanelContribution,
  SettingsPanelRegistration,
  ThemeContribution,
  ThemeRegistration
} from '@kisaki/extension-api'
import { isExtensionEventTopic } from '@kisaki/extension-api'
import type { ExtensionRegistry, LoadedExtensionRuntime } from '../extension-registry'
import type { ExtensionHostRpcServer } from '../rpc-server'
import { HostCommandContributions } from '../contributions/commands'
import { HostDeeplinkRouteContributions } from '../contributions/deeplink-routes'
import { HostEntityMenuContributions } from '../contributions/entity-menus'
import {
  HostScraperProviderContributions,
  MAIN_TO_HOST_SCRAPER_RPC
} from '../contributions/scraper-providers'
import { HostSettingsPanelContributions } from '../contributions/settings-panels'
import { HostThemeContributions } from '../contributions/themes'
import type { HostContributionDiagnosticInput, HostContributionScope } from '../contributions/types'
import { createDisposable, createDisposableStore } from './disposables'
import {
  createKisakiApi,
  createScopeCapturingKisakiApi,
  type KisakiApiBridgeHooks
} from './kisaki-api'
import { createExtensionLogger } from './logger'
import { resolveInsideExtension } from './utils/paths'
import {
  createDeeplinkRouteRegistrar,
  createCommandRegistrar,
  createEntityMenuRegistrar,
  createScraperProviderRegistrar,
  createSettingsPanelRegistrar,
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
  ScraperProviderFor,
  HostEventSubscriptionRecord
} from './types'
import type { ExtensionContextOptions } from './types'

const CONTRIBUTION_SYNC_REQUEST_TIMEOUT_MS = 10_000
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
  private readonly scraperProviders: HostScraperProviderContributions
  private readonly deeplinkRoutes: HostDeeplinkRouteContributions
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
      getRequestOptions: (scope: HostContributionScope) =>
        this.getContributionRequestOptions(scope),
      getCleanupRequestOptions: () => CONTRIBUTION_CLEANUP_REQUEST_OPTIONS,
      runInExtensionContext: <T>(
        runtimeOrScope: LoadedExtensionRuntime | HostContributionScope,
        callback: () => Promise<T> | T
      ) => this.runInExtensionContext(runtimeOrScope, callback),
      trackMainRequest: (scope: HostContributionScope, request: Promise<unknown>) => {
        this.trackMainRequest(scope, request)
      },
      reportDiagnostic: (
        scope: HostContributionScope,
        diagnostic: HostContributionDiagnosticInput
      ) => {
        this.reportRuntimeDiagnostic(scope, diagnostic)
      }
    }
    this.entityMenus = new HostEntityMenuContributions(contributionOptions)
    this.settingsPanels = new HostSettingsPanelContributions(contributionOptions)
    this.scraperProviders = new HostScraperProviderContributions(contributionOptions)
    this.deeplinkRoutes = new HostDeeplinkRouteContributions(contributionOptions)
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
    this.entityMenus.releaseAll()
    this.settingsPanels.releaseAll()
    await this.scraperProviders.releaseAll()
    this.deeplinkRoutes.releaseAll()
    this.themes.releaseAll()
    this.commands.releaseAll()
    this.pendingMainRequests.clear()
    this.scopedApis.clear()
    this.hostEventSubscriptions.clear()
    this.extensionEventListeners.clear()
    resetExtensionSdkBridge()
  }

  registerContributionRpcHandlers(): void {
    this.rpc.handle('contributions.entityMenus.resolve', (params, context) =>
      this.entityMenus.resolve(params, context.signal)
    )
    this.rpc.handle('contributions.entityMenus.invoke', (params, context) =>
      this.entityMenus.invoke(params, context.signal)
    )
    this.rpc.handle('contributions.entityMenus.release', (params) => {
      this.entityMenus.release(params)
      return {}
    })
    this.rpc.handle('contributions.settingsPanels.open', (params, context) =>
      this.settingsPanels.open(params, context.signal)
    )
    this.rpc.handle('contributions.settingsPanels.refresh', (params, context) =>
      this.settingsPanels.refresh(params, context.signal)
    )
    this.rpc.handle('contributions.settingsPanels.submit', (params, context) =>
      this.settingsPanels.submit(params, context.signal)
    )
    this.rpc.handle('contributions.settingsPanels.invoke', (params, context) =>
      this.settingsPanels.invoke(params, context.signal)
    )
    this.rpc.handle('contributions.settingsPanels.release', (params) => {
      this.settingsPanels.release(params)
      return {}
    })
    this.rpc.handle('contributions.deeplinkRoutes.handle', (params) =>
      this.deeplinkRoutes.handle(params)
    )
    this.rpc.handle('contributions.commands.execute', (params, context) =>
      this.commands.execute(params, context.signal)
    )
    this.registerScraperRpcHandlers()
  }

  private registerScraperRpcHandlers(): void {
    this.rpc.handle(MAIN_TO_HOST_SCRAPER_RPC.search, (params) =>
      this.scraperProviders.search(params)
    )
    this.rpc.handle(MAIN_TO_HOST_SCRAPER_RPC.resolve, (params) =>
      this.scraperProviders.resolve(params)
    )
    this.rpc.handle(MAIN_TO_HOST_SCRAPER_RPC.open, (params) =>
      this.scraperProviders.openSession(params)
    )
    this.rpc.handle(MAIN_TO_HOST_SCRAPER_RPC.get, (params) =>
      this.scraperProviders.getSession(params)
    )
    this.rpc.handle(MAIN_TO_HOST_SCRAPER_RPC.close, async (params) => {
      await this.scraperProviders.closeSession(params)
      return {}
    })
  }

  async flushRuntime(runtimeHandle: ExtensionRuntimeHandle): Promise<void> {
    const pending = this.pendingMainRequests.get(runtimeHandle)
    if (!pending || pending.size === 0) {
      return
    }

    await Promise.allSettled([...pending])
  }

  async releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): Promise<void> {
    this.entityMenus.releaseRuntime(runtimeHandle)
    this.settingsPanels.releaseRuntime(runtimeHandle)
    await this.scraperProviders.releaseRuntime(runtimeHandle)
    this.deeplinkRoutes.releaseRuntime(runtimeHandle)
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
          entityMenus: createEntityMenuRegistrar(this.bridge, subscriptions, scope),
          settingsPanels: createSettingsPanelRegistrar(this.bridge, subscriptions, scope),
          scraperProviders: createScraperProviderRegistrar(this.bridge, subscriptions, scope),
          deeplinkRoutes: createDeeplinkRouteRegistrar(this.bridge, subscriptions, scope),
          themes: createThemeRegistrar(this.bridge, subscriptions, scope)
        },
        asAbsolutePath: (relativePath: string) =>
          this.bridge.asAbsolutePath(options.extension.extensionPath, relativePath)
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
      registerEntityMenu: (scope, domain, menuScope, contribution) =>
        this.registerEntityMenu(scope, domain, menuScope, contribution),
      registerSettingsPanel: (scope, contribution) =>
        this.registerSettingsPanel(scope, contribution),
      registerScraperProvider: (scope, mediaType, provider) =>
        this.registerScraperProvider(scope, mediaType, provider),
      registerDeeplinkRoute: (scope, contribution) =>
        this.registerDeeplinkRoute(scope, contribution),
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

  private registerCommand(
    scope: ActiveExtensionScope,
    command: CommandContribution
  ): CommandRegistration {
    return this.commands.register(scope, command)
  }

  private registerEntityMenu<
    TDomain extends EntityMenuDomain,
    TScope extends EntityMenuScope<TDomain>
  >(
    scope: ActiveExtensionScope,
    domain: TDomain,
    menuScope: TScope,
    contribution: EntityMenuContribution<EntityMenuInputFor<TDomain, TScope>>
  ): EntityMenuRegistration {
    return this.entityMenus.register(scope, domain, menuScope, contribution)
  }

  private registerSettingsPanel(
    scope: ActiveExtensionScope,
    contribution: SettingsPanelContribution<any, any>
  ): SettingsPanelRegistration {
    return this.settingsPanels.register(scope, contribution)
  }

  private registerScraperProvider<TMediaType extends ScraperMediaType>(
    scope: ActiveExtensionScope,
    mediaType: TMediaType,
    provider: ScraperProviderFor<TMediaType>
  ): ScraperProviderRegistration {
    return this.scraperProviders.registerScraperProvider(scope, mediaType, provider)
  }

  private registerDeeplinkRoute<const TPattern extends string>(
    scope: ActiveExtensionScope,
    contribution: DeeplinkRouteContribution<TPattern>
  ): DeeplinkRouteRegistration {
    return this.deeplinkRoutes.register(scope, contribution)
  }

  private registerTheme(scope: ActiveExtensionScope, theme: ThemeContribution): ThemeRegistration {
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

  private getContributionRequestOptions(scope: ActiveExtensionScope): {
    timeoutMs: number
    signal?: AbortSignal
  } {
    const signal = this.registry.getByRuntimeHandle(scope.runtimeHandle)?.abortController.signal
    return signal
      ? { timeoutMs: CONTRIBUTION_SYNC_REQUEST_TIMEOUT_MS, signal }
      : { timeoutMs: CONTRIBUTION_SYNC_REQUEST_TIMEOUT_MS }
  }

  private trackMainRequest(scope: HostContributionScope, request: Promise<unknown>): void {
    let pending = this.pendingMainRequests.get(scope.runtimeHandle)
    if (!pending) {
      pending = new Set()
      this.pendingMainRequests.set(scope.runtimeHandle, pending)
    }

    const tracked = Promise.resolve(request)
      .then(() => undefined)
      .catch((error) => {
        console.warn(
          `[ExtensionHost][${scope.extensionId}] Failed to synchronize contribution registry:`,
          error
        )
      })
      .finally(() => {
        pending?.delete(tracked)
        if (pending?.size === 0) {
          this.pendingMainRequests.delete(scope.runtimeHandle)
        }
      })

    pending.add(tracked)
  }

  private reportRuntimeDiagnostic(
    scope: HostContributionScope,
    diagnostic: Omit<ExtensionRuntimeDiagnostic, 'createdAt'>
  ): void {
    void this.rpc
      .requestMain(
        'runtime.diagnostics.report',
        {
          runtimeHandle: scope.runtimeHandle,
          diagnostic: {
            ...diagnostic,
            createdAt: new Date().toISOString()
          }
        },
        this.getRequestOptions(scope)
      )
      .catch((error) => {
        console.warn(
          `[ExtensionHost][${scope.extensionId}] Failed to report runtime diagnostic:`,
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
