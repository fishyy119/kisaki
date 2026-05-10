import type { ExtensionRuntimeHandle } from '@kisaki/extension-api'
import type { ExtensionContributionSnapshot } from '@shared/extension'
import type { ExtensionHostRpcClient } from '../runtime/rpc-client'
import { ExtensionCommandContributionHost } from './commands'
import { ExtensionDeeplinkRouteContributionHost } from './deeplink-routes'
import { ExtensionEntityMenuContributionHost } from './entity-menus'
import { ExtensionScraperProviderContributionHost } from './scraper-providers'
import { ExtensionSettingsPanelContributionHost } from './settings-panels'
import { ExtensionThemeContributionHost } from './themes'
import type { ExtensionContributionHostOptions } from './types'

export class ExtensionContributionRegistry {
  readonly entityMenus: ExtensionEntityMenuContributionHost
  readonly settingsPanels: ExtensionSettingsPanelContributionHost
  readonly themes: ExtensionThemeContributionHost
  readonly deeplinkRoutes: ExtensionDeeplinkRouteContributionHost
  readonly scraperProviders: ExtensionScraperProviderContributionHost
  readonly commands: ExtensionCommandContributionHost

  constructor(private readonly options: ExtensionContributionHostOptions) {
    this.entityMenus = new ExtensionEntityMenuContributionHost(options)
    this.settingsPanels = new ExtensionSettingsPanelContributionHost(options)
    this.themes = new ExtensionThemeContributionHost(options)
    this.deeplinkRoutes = new ExtensionDeeplinkRouteContributionHost(options)
    this.scraperProviders = new ExtensionScraperProviderContributionHost(options)
    this.commands = new ExtensionCommandContributionHost(options)
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

  private notifyChanged(): void {
    this.options.onDidChange?.()
  }
}
