import { AsyncLocalStorage } from 'node:async_hooks'
import type {
  CardActionContribution,
  CardActionRegistration,
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
  ExtensionRuntimeDiagnostic,
  ExtensionRuntimeHandle,
  HostToMainRpcMethod,
  HostToMainRpcRequestMap,
  KisakiApi,
  ScraperMediaType,
  ScraperProviderRegistration,
  RpcParams,
  RpcResult,
  ThemeContribution,
  ThemeRegistration,
  WebviewDialogContribution,
  WebviewDialogRegistration,
  WebviewPageContribution,
  WebviewPageRegistration
} from '@kisaki3/extension-api'
import type { ExtensionRegistry, LoadedExtensionRuntime } from '../extension-registry'
import type { ExtensionHostRpcServer } from '../rpc-server'
import { HostCardActionContributionPoint } from '../contributions/card-actions'
import { HostCommandContributionPoint } from '../contributions/commands'
import { HostDeeplinkRouteContributionPoint } from '../contributions/deeplink-routes'
import { HostEntityMenuContributionPoint } from '../contributions/entity-menus'
import { HostHooksContributionPoint } from '../contributions/hooks'
import {
  HostScraperProviderContributionPoint,
  MAIN_TO_HOST_SCRAPER_RPC
} from '../contributions/scraper-providers'
import { HostThemeContributionPoint } from '../contributions/themes'
import { HostWebviewContributionPoint } from '../contributions/webviews'
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
  createCardActionRegistrar,
  createDeeplinkRouteRegistrar,
  createCommandRegistrar,
  createEntityMenuRegistrar,
  createHooksRegistrar,
  createScraperProviderRegistrar,
  createThemeRegistrar,
  createWebviewRegistrar
} from './registrars'
import { HostWebviewSessionManager } from './webviews'
import { createExtensionStorage } from './storage'
import { createExtensionSecrets } from './secrets'
import { configureExtensionSdkBridge, resetExtensionSdkBridge } from './store'
import {
  EXTENSION_CLEANUP_TIMEOUT_MS,
  EXTENSION_CONTRIBUTION_SYNC_TIMEOUT_MS
} from '../../../shared/rpc-timeouts'
import type { ActiveExtensionScope, ExtensionSdkBridge, ScraperProviderFor } from './types'
import type { ExtensionContextOptions } from './types'

const CONTRIBUTION_CLEANUP_REQUEST_OPTIONS = Object.freeze({
  timeoutMs: EXTENSION_CLEANUP_TIMEOUT_MS
})

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
  private readonly entityMenus: HostEntityMenuContributionPoint
  private readonly cardActions: HostCardActionContributionPoint
  private readonly scraperProviders: HostScraperProviderContributionPoint
  private readonly deeplinkRoutes: HostDeeplinkRouteContributionPoint
  private readonly themes: HostThemeContributionPoint
  private readonly commands: HostCommandContributionPoint
  private readonly webviews: HostWebviewContributionPoint
  private readonly webviewSessions: HostWebviewSessionManager
  private readonly hooks: HostHooksContributionPoint
  private readonly scopedApis = new Map<ExtensionRuntimeHandle, KisakiApi>()
  private readonly pendingMainRequests = new Map<ExtensionRuntimeHandle, Set<Promise<void>>>()
  private readonly taskRunAbortControllers = new Map<
    ExtensionRuntimeHandle,
    Map<string, AbortController>
  >()
  private readonly hookNotifyCleanup: () => void
  private readonly taskRunCancelCleanup: () => void
  private readonly webviewOpenedCleanup: () => void
  private readonly webviewMessageCleanup: () => void
  private readonly webviewClosedCleanup: () => void

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
        callback: () => Promise<T> | T,
        signal?: AbortSignal
      ) => this.runInExtensionContext(runtimeOrScope, callback, signal),
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
    this.entityMenus = new HostEntityMenuContributionPoint(contributionOptions)
    this.cardActions = new HostCardActionContributionPoint(contributionOptions)
    this.scraperProviders = new HostScraperProviderContributionPoint(contributionOptions)
    this.deeplinkRoutes = new HostDeeplinkRouteContributionPoint(contributionOptions)
    this.themes = new HostThemeContributionPoint(contributionOptions)
    this.commands = new HostCommandContributionPoint(contributionOptions)
    this.webviewSessions = new HostWebviewSessionManager({
      runInExtensionContext: (scope, callback) => this.runInExtensionContext(scope, callback),
      requestMain: (scope, method, params) => this.requestMain(scope, method, params)
    })
    this.webviews = new HostWebviewContributionPoint({
      ...contributionOptions,
      createWebviewHandle: (scope, webviewId) => this.webviewSessions.createHandle(scope, webviewId)
    })
    this.hooks = new HostHooksContributionPoint(contributionOptions)
    this.hookNotifyCleanup = this.rpc.onMainEvent('contributions.hooks.notify', (payload) =>
      this.hooks.handleNotify(payload)
    )
    this.taskRunCancelCleanup = this.rpc.onMainEvent(
      'capabilities.taskRuns.cancelRequested',
      (payload) => this.handleTaskRunCancelRequested(payload)
    )
    this.webviewOpenedCleanup = this.rpc.onMainEvent('capabilities.webviews.opened', (payload) =>
      this.webviews.handleOpened(payload)
    )
    this.webviewMessageCleanup = this.rpc.onMainEvent(
      'capabilities.webviews.messagePosted',
      (payload) => this.webviewSessions.handleMessagePosted(payload)
    )
    this.webviewClosedCleanup = this.rpc.onMainEvent('capabilities.webviews.closed', (payload) =>
      this.webviewSessions.handleClosed(payload)
    )
  }

  configure(): void {
    configureExtensionSdkBridge(this.bridge)
  }

  async dispose(): Promise<void> {
    this.hookNotifyCleanup()
    this.taskRunCancelCleanup()
    this.webviewOpenedCleanup()
    this.webviewMessageCleanup()
    this.webviewClosedCleanup()
    this.entityMenus.releaseAll()
    this.cardActions.releaseAll()
    await this.scraperProviders.releaseAll()
    this.deeplinkRoutes.releaseAll()
    this.themes.releaseAll()
    this.commands.releaseAll()
    this.webviews.releaseAll()
    this.webviewSessions.releaseAll()
    this.hooks.releaseAll()
    this.pendingMainRequests.clear()
    this.abortAllTaskRuns()
    this.taskRunAbortControllers.clear()
    this.scopedApis.clear()
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
    this.rpc.handle('contributions.cardActions.run', (params, context) =>
      this.cardActions.run(params, context.signal)
    )
    this.rpc.handle('contributions.deeplinkRoutes.handle', (params, context) =>
      this.deeplinkRoutes.handle(params, context.signal)
    )
    this.rpc.handle('contributions.commands.execute', (params, context) =>
      this.commands.execute(params, context.signal)
    )
    this.rpc.handle('contributions.hooks.invoke', (params, context) =>
      this.hooks.invoke(params, context.signal)
    )
    this.registerScraperRpcHandlers()
  }

  private registerScraperRpcHandlers(): void {
    this.rpc.handle(MAIN_TO_HOST_SCRAPER_RPC.search, (params, context) =>
      this.scraperProviders.search(params, context.signal)
    )
    this.rpc.handle(MAIN_TO_HOST_SCRAPER_RPC.resolve, (params, context) =>
      this.scraperProviders.resolve(params, context.signal)
    )
    this.rpc.handle(MAIN_TO_HOST_SCRAPER_RPC.open, (params, context) =>
      this.scraperProviders.openSession(params, context.signal)
    )
    this.rpc.handle(MAIN_TO_HOST_SCRAPER_RPC.get, (params, context) =>
      this.scraperProviders.getSession(params, context.signal)
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
    this.cardActions.releaseRuntime(runtimeHandle)
    await this.scraperProviders.releaseRuntime(runtimeHandle)
    this.deeplinkRoutes.releaseRuntime(runtimeHandle)
    this.themes.releaseRuntime(runtimeHandle)
    this.commands.releaseRuntime(runtimeHandle)
    this.webviews.releaseRuntime(runtimeHandle)
    this.webviewSessions.releaseRuntime(runtimeHandle)
    this.hooks.releaseRuntime(runtimeHandle)
    this.abortTaskRunsForRuntime(runtimeHandle)
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
          cardActions: createCardActionRegistrar(this.bridge, subscriptions, scope),
          scraperProviders: createScraperProviderRegistrar(this.bridge, subscriptions, scope),
          deeplinkRoutes: createDeeplinkRouteRegistrar(this.bridge, subscriptions, scope),
          themes: createThemeRegistrar(this.bridge, subscriptions, scope),
          webviews: createWebviewRegistrar(this.bridge, subscriptions, scope)
        },
        hooks: createHooksRegistrar(this.bridge, subscriptions, scope),
        asAbsolutePath: (relativePath: string) =>
          this.bridge.asAbsolutePath(options.extension.extensionPath, relativePath)
      },
      subscriptions,
      scope
    }
  }

  runInExtensionContext<T>(
    runtimeOrScope: LoadedExtensionRuntime | ActiveExtensionScope,
    callback: () => Promise<T> | T,
    signal?: AbortSignal
  ): Promise<T> | T {
    return this.executionScope.run(toScope(runtimeOrScope, signal), callback)
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
          getRequestOptions: (requestScope) => this.getRequestOptions(requestScope),
          trackRequest: (request) => this.trackPendingMainRequest(scope.runtimeHandle, request)
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
      registerCardAction: (scope, action) => this.registerCardAction(scope, action),
      registerScraperProvider: (scope, mediaType, provider) =>
        this.registerScraperProvider(scope, mediaType, provider),
      registerDeeplinkRoute: (scope, contribution) =>
        this.registerDeeplinkRoute(scope, contribution),
      registerTheme: (scope, theme) => this.registerTheme(scope, theme),
      registerWebviewPage: (scope, page) => this.registerWebviewPage(scope, page),
      registerWebviewDialog: (scope, dialog) => this.registerWebviewDialog(scope, dialog),
      registerHook: (scope, pointId, handler, options) =>
        this.hooks.register(scope, pointId, handler, options),
      asAbsolutePath: (extensionPath, relativePath) =>
        resolveInsideExtension(extensionPath, relativePath)
    }
  }

  private createKisakiApiHooks(): KisakiApiBridgeHooks {
    return {
      requireCurrentScope: () => this.requireCurrentScope(),
      requestMain: (scope, method, params) => this.requestMain(scope, method, params),
      registerTaskRunAbortController: (scope, runId, controller) =>
        this.registerTaskRunAbortController(scope, runId, controller),
      createWebviewSession: (scope, webviewId) =>
        this.webviewSessions.createHandle(scope, webviewId)
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

  private registerCardAction(
    scope: ActiveExtensionScope,
    action: CardActionContribution
  ): CardActionRegistration {
    return this.cardActions.register(scope, action)
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

  private registerWebviewPage(
    scope: ActiveExtensionScope,
    page: WebviewPageContribution
  ): WebviewPageRegistration {
    return this.webviews.registerPage(scope, page)
  }

  private registerWebviewDialog(
    scope: ActiveExtensionScope,
    dialog: WebviewDialogContribution
  ): WebviewDialogRegistration {
    return this.webviews.registerDialog(scope, dialog)
  }

  private registerTaskRunAbortController(
    scope: ActiveExtensionScope,
    runId: string,
    controller: AbortController
  ): Disposable {
    let scopedControllers = this.taskRunAbortControllers.get(scope.runtimeHandle)
    if (!scopedControllers) {
      scopedControllers = new Map()
      this.taskRunAbortControllers.set(scope.runtimeHandle, scopedControllers)
    }

    scopedControllers.set(runId, controller)
    return createDisposable(() => {
      const current = this.taskRunAbortControllers.get(scope.runtimeHandle)
      current?.delete(runId)
      if (current?.size === 0) {
        this.taskRunAbortControllers.delete(scope.runtimeHandle)
      }
    })
  }

  private handleTaskRunCancelRequested(payload: {
    runtimeHandle: ExtensionRuntimeHandle
    runId: string
  }): void {
    this.taskRunAbortControllers.get(payload.runtimeHandle)?.get(payload.runId)?.abort()
  }

  private abortTaskRunsForRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    const controllers = this.taskRunAbortControllers.get(runtimeHandle)
    if (!controllers) {
      return
    }

    for (const controller of controllers.values()) {
      controller.abort()
    }
    this.taskRunAbortControllers.delete(runtimeHandle)
  }

  private abortAllTaskRuns(): void {
    for (const runtimeHandle of [...this.taskRunAbortControllers.keys()]) {
      this.abortTaskRunsForRuntime(runtimeHandle)
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
    const runtimeSignal = this.registry.getByRuntimeHandle(scope.runtimeHandle)?.abortController
      .signal
    const signal = combineAbortSignals(runtimeSignal, scope.signal)
    return signal ? { signal } : undefined
  }

  private getContributionRequestOptions(scope: ActiveExtensionScope): {
    timeoutMs: number
    signal?: AbortSignal
  } {
    const signal = this.registry.getByRuntimeHandle(scope.runtimeHandle)?.abortController.signal
    return signal
      ? { timeoutMs: EXTENSION_CONTRIBUTION_SYNC_TIMEOUT_MS, signal }
      : { timeoutMs: EXTENSION_CONTRIBUTION_SYNC_TIMEOUT_MS }
  }

  private trackMainRequest(scope: HostContributionScope, request: Promise<unknown>): void {
    const reported = Promise.resolve(request).catch((error) => {
      console.warn(
        `[ExtensionHost][${scope.extensionId}] Failed to synchronize contribution registry:`,
        error
      )
    })

    this.trackPendingMainRequest(scope.runtimeHandle, reported)
  }

  private trackPendingMainRequest(
    runtimeHandle: ExtensionRuntimeHandle,
    request: Promise<unknown>
  ): void {
    let pending = this.pendingMainRequests.get(runtimeHandle)
    if (!pending) {
      pending = new Set()
      this.pendingMainRequests.set(runtimeHandle, pending)
    }

    const tracked = Promise.resolve(request)
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        pending?.delete(tracked)
        if (pending?.size === 0) {
          this.pendingMainRequests.delete(runtimeHandle)
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
  runtimeOrScope: LoadedExtensionRuntime | ActiveExtensionScope,
  signal?: AbortSignal
): ActiveExtensionScope {
  if ('metadata' in runtimeOrScope) {
    return {
      extensionId: runtimeOrScope.metadata.id,
      runtimeHandle: runtimeOrScope.runtimeHandle,
      signal
    }
  }

  return signal ? { ...runtimeOrScope, signal } : runtimeOrScope
}

function combineAbortSignals(
  left: AbortSignal | undefined,
  right: AbortSignal | undefined
): AbortSignal | undefined {
  if (!left) {
    return right
  }

  if (!right || left === right) {
    return left
  }

  if (left.aborted) {
    return left
  }

  if (right.aborted) {
    return right
  }

  const anySignal = AbortSignal as typeof AbortSignal & {
    any?: (signals: AbortSignal[]) => AbortSignal
  }
  if (typeof anySignal.any === 'function') {
    return anySignal.any([left, right])
  }

  const controller = new AbortController()
  const abort = () => controller.abort()
  left.addEventListener('abort', abort, { once: true })
  right.addEventListener('abort', abort, { once: true })
  return controller.signal
}
