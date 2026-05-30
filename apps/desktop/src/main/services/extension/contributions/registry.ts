import type { ExtensionRuntimeHandle } from '@kisaki3/extension-api'
import type {
  ExtensionContributionSnapshot,
  ExtensionEntityMenuInvokeRequest,
  ExtensionEntityMenuInvokeResponse,
  ExtensionEntityMenuReleaseRequest,
  ExtensionEntityMenuResolveRequest,
  ExtensionResolvedEntityMenu,
  ExtensionSettingsPanelCallbackResponse,
  ExtensionSettingsPanelInvokeRequest,
  ExtensionSettingsPanelOpenRequest,
  ExtensionSettingsPanelOpenResponse,
  ExtensionSettingsPanelRefreshRequest,
  ExtensionSettingsPanelRefreshResponse,
  ExtensionSettingsPanelRegistrationInfo,
  ExtensionSettingsPanelReleaseRequest,
  ExtensionSettingsPanelSubmitRequest,
  ExtensionThemeRegistrationInfo
} from '@shared/extension'
import type { ExtensionHostRpcClient } from '../runtime'
import { requireSafeExtensionId } from '../shared/path-confinement'
import { ExtensionCommandContributionPoint } from './commands'
import { ExtensionDeeplinkRouteContributionPoint } from './deeplink-routes'
import { ExtensionEntityMenuContributionPoint } from './entity-menus'
import { ExtensionScraperProviderContributionPoint } from './scraper-providers'
import { ExtensionSettingsPanelContributionPoint } from './settings-panels'
import { ExtensionThemeContributionPoint } from './themes'
import type {
  ExtensionContributionDomainOptions,
  ExtensionContributionReleaseDiagnostic
} from './types'

export class ExtensionContributionRegistry {
  readonly entityMenus: ExtensionEntityMenuContributionPoint
  readonly settingsPanels: ExtensionSettingsPanelContributionPoint
  readonly themes: ExtensionThemeContributionPoint
  readonly deeplinkRoutes: ExtensionDeeplinkRouteContributionPoint
  readonly scraperProviders: ExtensionScraperProviderContributionPoint
  readonly commands: ExtensionCommandContributionPoint

  constructor(private readonly options: ExtensionContributionDomainOptions) {
    this.entityMenus = new ExtensionEntityMenuContributionPoint(options)
    this.settingsPanels = new ExtensionSettingsPanelContributionPoint(options)
    this.themes = new ExtensionThemeContributionPoint(options)
    this.deeplinkRoutes = new ExtensionDeeplinkRouteContributionPoint(options)
    this.scraperProviders = new ExtensionScraperProviderContributionPoint(options)
    this.commands = new ExtensionCommandContributionPoint(options)
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
      'contributions.settingsPanels.register',
      async ({ runtimeHandle, panel }) => {
        this.settingsPanels.register(runtimeHandle, panel)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.settingsPanels.refreshRequested',
      async ({ runtimeHandle, contributionId, reason }) => {
        this.settingsPanels.notifyRefreshRequested(runtimeHandle, contributionId, reason)
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.settingsPanels.unregister',
      async ({ runtimeHandle, contributionId }) => {
        this.settingsPanels.unregister(runtimeHandle, contributionId)
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
  }

  async releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): Promise<void> {
    try {
      this.entityMenus.releaseRuntime(runtimeHandle)
      this.settingsPanels.releaseRuntime(runtimeHandle)
      this.themes.releaseRuntime(runtimeHandle)
      this.deeplinkRoutes.releaseRuntime(runtimeHandle)
      await this.scraperProviders.releaseRuntime(runtimeHandle)
      this.commands.releaseRuntime(runtimeHandle)
    } finally {
      this.notifyChanged()
    }
  }

  async releaseAll(): Promise<void> {
    try {
      this.entityMenus.releaseAll()
      this.settingsPanels.releaseAll()
      this.themes.releaseAll()
      this.deeplinkRoutes.releaseAll()
      await this.scraperProviders.releaseAll()
      this.commands.releaseAll()
    } finally {
      this.notifyChanged()
    }
  }

  getSnapshot(): ExtensionContributionSnapshot {
    return {
      entityMenus: this.entityMenus.getSnapshot(),
      settingsPanels: this.settingsPanels.getSnapshot(),
      scraperProviders: this.scraperProviders.getSnapshot(),
      deeplinkRoutes: this.deeplinkRoutes.getSnapshot(),
      themes: this.themes.getSnapshot()
    }
  }

  listSettingsPanels(): readonly ExtensionSettingsPanelRegistrationInfo[] {
    return this.settingsPanels.getSnapshot()
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

  openSettingsPanel(
    request: ExtensionSettingsPanelOpenRequest
  ): Promise<ExtensionSettingsPanelOpenResponse> {
    return this.settingsPanels.open({
      ...request,
      extensionId: requireSafeExtensionId(request.extensionId)
    })
  }

  refreshSettingsPanel(
    request: ExtensionSettingsPanelRefreshRequest
  ): Promise<ExtensionSettingsPanelRefreshResponse> {
    return this.settingsPanels.refresh({
      ...request,
      extensionId: requireSafeExtensionId(request.extensionId)
    })
  }

  submitSettingsPanel(
    request: ExtensionSettingsPanelSubmitRequest
  ): Promise<ExtensionSettingsPanelCallbackResponse> {
    return this.settingsPanels.submit({
      ...request,
      extensionId: requireSafeExtensionId(request.extensionId)
    })
  }

  invokeSettingsPanelNode(
    request: ExtensionSettingsPanelInvokeRequest
  ): Promise<ExtensionSettingsPanelCallbackResponse> {
    return this.settingsPanels.invoke({
      ...request,
      extensionId: requireSafeExtensionId(request.extensionId)
    })
  }

  releaseSettingsPanel(request: ExtensionSettingsPanelReleaseRequest): Promise<void> {
    return this.settingsPanels.release({
      ...request,
      extensionId: requireSafeExtensionId(request.extensionId)
    })
  }

  assertReleased(extensionId: string, operation: string): void {
    const diagnostics = [
      ...this.entityMenus.getReleaseDiagnostics(extensionId),
      ...this.settingsPanels.getReleaseDiagnostics(extensionId),
      ...this.scraperProviders.getReleaseDiagnostics(extensionId),
      ...this.deeplinkRoutes.getReleaseDiagnostics(extensionId),
      ...this.themes.getReleaseDiagnostics(extensionId),
      ...this.commands.getReleaseDiagnostics(extensionId)
    ]

    if (diagnostics.length === 0) {
      return
    }

    throw new Error(
      `Extension ${operation} did not release contributions for "${extensionId}": ${formatReleaseDiagnostics(diagnostics)}.`
    )
  }

  private notifyChanged(): void {
    this.options.onDidChange?.()
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
