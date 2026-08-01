import type {
  ExtensionRuntimeHandle,
  MainToHostRpcEvent,
  MainToHostRpcEventMap
} from '@kisaki3/extension-api'
import type {
  ExtensionCardActionRunRequest,
  ExtensionContributionSnapshot,
  ExtensionEntityMenuInvokeRequest,
  ExtensionEntityMenuInvokeResponse,
  ExtensionEntityMenuRefreshRequestedEvent,
  ExtensionEntityMenuReleaseRequest,
  ExtensionEntityMenuResolveRequest,
  ExtensionResolvedEntityMenu,
  ExtensionThemeRegistrationInfo
} from '@shared/extension'
import type { BootstrapHooks } from '@main/bootstrap/hooks'
import type { CommandService } from '@main/services/command'
import type { DbHooks } from '@main/services/db/hooks'
import type { DeeplinkService } from '@main/services/deeplink'
import type { I18nHooks } from '@main/services/i18n/hooks'
import type { IngestHooks } from '@main/services/ingest/hooks'
import type { LauncherHooks } from '@main/services/launcher/hooks'
import type { MonitorHooks } from '@main/services/monitor/hooks'
import type { ScannerHooks } from '@main/services/scanner/hooks'
import type { ScraperService } from '@main/services/scraper'
import type { ScraperHooks } from '@main/services/scraper/hooks'
import type { WindowHooks } from '@main/services/window/hooks'
import type { ExtensionHostRpcClient } from '../runtime'
import { requireSafeExtensionId } from '../shared/path-confinement'
import { ExtensionCardActionContributionPoint } from './card-actions'
import { ExtensionCommandContributionPoint } from './commands'
import { ExtensionDeeplinkRouteContributionPoint } from './deeplink-routes'
import { ExtensionEntityMenuContributionPoint } from './entity-menus'
import {
  ExtensionHookContributionPoint,
  bindAppHookPoints,
  bindIngestHookPoints,
  bindLibraryHookPoints,
  bindPlayHookPoints,
  bindScannerHookPoints,
  bindScraperHookPoints
} from './hooks'
import { ExtensionScraperProviderContributionPoint } from './scraper-providers'
import { ExtensionThemeContributionPoint } from './themes'
import { ExtensionWebviewContributionPoint } from './webviews'
import type {
  ExtensionContributionPointOptions,
  ExtensionContributionReleaseDiagnostic
} from './types'

/** Module hook surfaces the hooks contribution point binds to at startup. */
export interface ExtensionHookModuleSurfaces {
  bootstrap: BootstrapHooks
  db: DbHooks
  i18n: I18nHooks
  window: WindowHooks
  scraper: ScraperHooks
  ingest: IngestHooks
  scanner: ScannerHooks
  launcher: LauncherHooks
  monitor: MonitorHooks
}

export interface ExtensionContributionRegistryOptions extends ExtensionContributionPointOptions {
  command: CommandService
  deeplink: DeeplinkService
  scraper: ScraperService
  moduleHooks: ExtensionHookModuleSurfaces
  sendHostEvent<K extends MainToHostRpcEvent>(name: K, payload: MainToHostRpcEventMap[K]): void
  onContributionsChanged?: () => void
  onEntityMenusRefreshRequested?: (event: ExtensionEntityMenuRefreshRequestedEvent) => void
}

export class ExtensionContributionRegistry {
  readonly entityMenus: ExtensionEntityMenuContributionPoint
  readonly cardActions: ExtensionCardActionContributionPoint
  readonly themes: ExtensionThemeContributionPoint
  readonly deeplinkRoutes: ExtensionDeeplinkRouteContributionPoint
  readonly scraperProviders: ExtensionScraperProviderContributionPoint
  readonly commands: ExtensionCommandContributionPoint
  readonly webviews: ExtensionWebviewContributionPoint
  readonly hooks: ExtensionHookContributionPoint

  constructor(private readonly options: ExtensionContributionRegistryOptions) {
    const base: ExtensionContributionPointOptions = {
      resolveRuntimeHandle: options.resolveRuntimeHandle,
      requestHost: options.requestHost
    }
    this.entityMenus = new ExtensionEntityMenuContributionPoint({
      ...base,
      onRefreshRequested: options.onEntityMenusRefreshRequested
    })
    this.cardActions = new ExtensionCardActionContributionPoint(base)
    this.themes = new ExtensionThemeContributionPoint(base)
    this.deeplinkRoutes = new ExtensionDeeplinkRouteContributionPoint({
      ...base,
      deeplink: options.deeplink
    })
    this.scraperProviders = new ExtensionScraperProviderContributionPoint({
      ...base,
      scraper: options.scraper
    })
    this.commands = new ExtensionCommandContributionPoint({
      ...base,
      command: options.command
    })
    this.webviews = new ExtensionWebviewContributionPoint(base)
    this.hooks = new ExtensionHookContributionPoint({
      ...base,
      sendHostEvent: options.sendHostEvent
    })

    const surfaces = options.moduleHooks
    bindScraperHookPoints(surfaces.scraper, this.hooks)
    bindIngestHookPoints(surfaces.ingest, this.hooks)
    bindScannerHookPoints(surfaces.scanner, this.hooks)
    bindPlayHookPoints(surfaces.launcher, surfaces.monitor, this.hooks)
    bindLibraryHookPoints(surfaces.db, this.hooks)
    bindAppHookPoints(surfaces.bootstrap, surfaces.db, surfaces.i18n, surfaces.window, this.hooks)
  }

  registerRpcHandlers(rpc: ExtensionHostRpcClient): void {
    rpc.handleHostRequest('contributions.entityMenus.register', async ({ runtimeHandle, menu }) => {
      this.entityMenus.register(runtimeHandle, menu)
      this.notifyChanged()
      return {}
    })
    rpc.handleHostRequest(
      'contributions.entityMenus.unregister',
      async ({ runtimeHandle, domain, scope, contributionId }) => {
        this.entityMenus.unregister(runtimeHandle, domain, scope, contributionId)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.entityMenus.refreshRequested',
      async ({ runtimeHandle, domain, scope, contributionId, reason }) => {
        this.entityMenus.notifyRefreshRequested(
          runtimeHandle,
          domain,
          scope,
          contributionId,
          reason
        )
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.cardActions.register',
      async ({ runtimeHandle, action }) => {
        this.cardActions.register(runtimeHandle, action)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.cardActions.unregister',
      async ({ runtimeHandle, contributionId }) => {
        this.cardActions.unregister(runtimeHandle, contributionId)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.scraperProviders.register',
      async ({ runtimeHandle, mediaType, provider }) => {
        await this.scraperProviders.registerProvider(runtimeHandle, mediaType, provider)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.scraperProviders.unregister',
      async ({ runtimeHandle, mediaType, providerId }) => {
        await this.scraperProviders.unregisterProvider(runtimeHandle, mediaType, providerId)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.deeplinkRoutes.register',
      async ({ runtimeHandle, route }) => {
        this.deeplinkRoutes.register(runtimeHandle, route)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.deeplinkRoutes.unregister',
      async ({ runtimeHandle, contributionId }) => {
        this.deeplinkRoutes.unregister(runtimeHandle, contributionId)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest('contributions.themes.register', async ({ runtimeHandle, theme }) => {
      this.themes.register(runtimeHandle, theme)
      this.notifyChanged()
      return {}
    })
    rpc.handleHostRequest('contributions.themes.unregister', async ({ runtimeHandle, themeId }) => {
      this.themes.unregister(runtimeHandle, themeId)
      this.notifyChanged()
      return {}
    })
    rpc.handleHostRequest('contributions.commands.register', async ({ runtimeHandle, command }) => {
      this.commands.register(runtimeHandle, command)
      return {}
    })
    rpc.handleHostRequest(
      'contributions.commands.unregister',
      async ({ runtimeHandle, commandId }) => {
        this.commands.unregister(runtimeHandle, commandId)
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.webviews.registerPage',
      async ({ runtimeHandle, page }) => {
        this.webviews.registerPage(runtimeHandle, page)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.webviews.unregisterPage',
      async ({ runtimeHandle, pageId }) => {
        this.webviews.unregisterPage(runtimeHandle, pageId)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.webviews.registerDialog',
      async ({ runtimeHandle, dialog }) => {
        this.webviews.registerDialog(runtimeHandle, dialog)
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.webviews.unregisterDialog',
      async ({ runtimeHandle, dialogId }) => {
        this.webviews.unregisterDialog(runtimeHandle, dialogId)
        return {}
      }
    )
    rpc.handleHostRequest('contributions.hooks.register', async ({ runtimeHandle, hook }) => {
      this.hooks.register(runtimeHandle, hook)
      return {}
    })
    rpc.handleHostRequest(
      'contributions.hooks.unregister',
      async ({ runtimeHandle, registrationId }) => {
        this.hooks.unregister(runtimeHandle, registrationId)
        return {}
      }
    )
  }

  async releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): Promise<void> {
    try {
      this.entityMenus.releaseRuntime(runtimeHandle)
      this.cardActions.releaseRuntime(runtimeHandle)
      this.themes.releaseRuntime(runtimeHandle)
      this.deeplinkRoutes.releaseRuntime(runtimeHandle)
      await this.scraperProviders.releaseRuntime(runtimeHandle)
      this.commands.releaseRuntime(runtimeHandle)
      this.webviews.releaseRuntime(runtimeHandle)
      this.hooks.releaseRuntime(runtimeHandle)
    } finally {
      this.notifyChanged()
    }
  }

  async releaseAll(): Promise<void> {
    try {
      this.entityMenus.releaseAll()
      this.cardActions.releaseAll()
      this.themes.releaseAll()
      this.deeplinkRoutes.releaseAll()
      await this.scraperProviders.releaseAll()
      this.commands.releaseAll()
      this.webviews.releaseAll()
      this.hooks.releaseAll()
    } finally {
      this.notifyChanged()
    }
  }

  getSnapshot(): ExtensionContributionSnapshot {
    return {
      entityMenus: this.entityMenus.getSnapshot(),
      cardActions: this.cardActions.getSnapshot(),
      scraperProviders: this.scraperProviders.getSnapshot(),
      deeplinkRoutes: this.deeplinkRoutes.getSnapshot(),
      themes: this.themes.getSnapshot(),
      webviewPages: this.webviews.getSnapshot()
    }
  }

  listThemes(): readonly ExtensionThemeRegistrationInfo[] {
    return this.themes.getSnapshot()
  }

  resolveEntityMenu(
    request: ExtensionEntityMenuResolveRequest
  ): Promise<ExtensionResolvedEntityMenu> {
    return this.entityMenus.resolve(request)
  }

  invokeEntityMenuCallback(
    request: ExtensionEntityMenuInvokeRequest
  ): Promise<ExtensionEntityMenuInvokeResponse> {
    return this.entityMenus.invoke({
      ...request,
      extensionId: requireSafeExtensionId(request.extensionId)
    })
  }

  releaseEntityMenu(request: ExtensionEntityMenuReleaseRequest): Promise<void> {
    return this.entityMenus.release(request)
  }

  runCardAction(request: ExtensionCardActionRunRequest): Promise<void> {
    return this.cardActions.run({
      ...request,
      extensionId: requireSafeExtensionId(request.extensionId)
    })
  }

  assertReleased(extensionId: string, operation: string): void {
    const diagnostics = [
      ...this.entityMenus.getReleaseDiagnostics(extensionId),
      ...this.cardActions.getReleaseDiagnostics(extensionId),
      ...this.scraperProviders.getReleaseDiagnostics(extensionId),
      ...this.deeplinkRoutes.getReleaseDiagnostics(extensionId),
      ...this.themes.getReleaseDiagnostics(extensionId),
      ...this.commands.getReleaseDiagnostics(extensionId),
      ...this.webviews.getReleaseDiagnostics(extensionId),
      ...this.hooks.getReleaseDiagnostics(extensionId)
    ]

    if (diagnostics.length === 0) {
      return
    }

    throw new Error(
      `Extension ${operation} did not release contributions for "${extensionId}": ${formatReleaseDiagnostics(diagnostics)}.`
    )
  }

  private notifyChanged(): void {
    this.options.onContributionsChanged?.()
  }
}

function formatReleaseDiagnostics(
  diagnostics: readonly ExtensionContributionReleaseDiagnostic[]
): string {
  const byDomain = new Map<string, Set<string>>()

  for (const diagnostic of diagnostics) {
    const details = byDomain.get(diagnostic.domain) ?? new Set<string>()
    details.add(diagnostic.detail)
    byDomain.set(diagnostic.domain, details)
  }

  return [...byDomain]
    .map(([domain, details]) => `${domain} (${[...details].join(', ')})`)
    .join('; ')
}
