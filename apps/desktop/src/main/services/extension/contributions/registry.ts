import type { ExtensionRuntimeHandle } from '@kisaki/extension-api'
import type { ExtensionContributionSnapshot } from '@shared/extension'
import type { ExtensionHostRpcClient } from '../runtime/rpc-client'
import { ExtensionDeeplinkContributionHost } from './deeplinks'
import { ExtensionEntityMenuContributionHost } from './entity-menus'
import { ExtensionScraperContributionHost } from './scrapers'
import { ExtensionSettingsPanelContributionHost } from './settings-panels'
import { ExtensionThemeContributionHost } from './themes'
import type { ExtensionContributionHostOptions } from './types'

export class ExtensionContributionRegistry {
  readonly entityMenus: ExtensionEntityMenuContributionHost
  readonly settingsPanels: ExtensionSettingsPanelContributionHost
  readonly themes: ExtensionThemeContributionHost
  readonly deeplinks: ExtensionDeeplinkContributionHost
  readonly scrapers: ExtensionScraperContributionHost

  constructor(options: ExtensionContributionHostOptions) {
    this.entityMenus = new ExtensionEntityMenuContributionHost(options)
    this.settingsPanels = new ExtensionSettingsPanelContributionHost(options)
    this.themes = new ExtensionThemeContributionHost(options)
    this.deeplinks = new ExtensionDeeplinkContributionHost(options)
    this.scrapers = new ExtensionScraperContributionHost(options)
  }

  registerRpcHandlers(rpc: ExtensionHostRpcClient): void {
    rpc.handleHostRequest(
      'bridge.entityMenus.register',
      async ({ runtimeHandle, contribution }) => {
        this.entityMenus.register(runtimeHandle, contribution)
        return {}
      }
    )
    rpc.handleHostRequest(
      'bridge.entityMenus.unregister',
      async ({ runtimeHandle, contributionId }) => {
        this.entityMenus.unregister(runtimeHandle, contributionId)
        return {}
      }
    )
    rpc.handleHostRequest(
      'bridge.settingsPanels.register',
      async ({ runtimeHandle, contribution }) => {
        this.settingsPanels.register(runtimeHandle, contribution)
        return {}
      }
    )
    rpc.handleHostRequest(
      'bridge.settingsPanels.unregister',
      async ({ runtimeHandle, panelId }) => {
        this.settingsPanels.unregister(runtimeHandle, panelId)
        return {}
      }
    )
    rpc.handleHostRequest('bridge.scrapers.games.register', async ({ runtimeHandle, provider }) => {
      await this.scrapers.registerGameProvider(runtimeHandle, provider)
      return {}
    })
    rpc.handleHostRequest(
      'bridge.scrapers.games.unregister',
      async ({ runtimeHandle, providerId }) => {
        await this.scrapers.unregisterGameProvider(runtimeHandle, providerId)
        return {}
      }
    )
    rpc.handleHostRequest(
      'bridge.scrapers.persons.register',
      async ({ runtimeHandle, provider }) => {
        await this.scrapers.registerPersonProvider(runtimeHandle, provider)
        return {}
      }
    )
    rpc.handleHostRequest(
      'bridge.scrapers.persons.unregister',
      async ({ runtimeHandle, providerId }) => {
        await this.scrapers.unregisterPersonProvider(runtimeHandle, providerId)
        return {}
      }
    )
    rpc.handleHostRequest(
      'bridge.scrapers.companies.register',
      async ({ runtimeHandle, provider }) => {
        await this.scrapers.registerCompanyProvider(runtimeHandle, provider)
        return {}
      }
    )
    rpc.handleHostRequest(
      'bridge.scrapers.companies.unregister',
      async ({ runtimeHandle, providerId }) => {
        await this.scrapers.unregisterCompanyProvider(runtimeHandle, providerId)
        return {}
      }
    )
    rpc.handleHostRequest(
      'bridge.scrapers.characters.register',
      async ({ runtimeHandle, provider }) => {
        await this.scrapers.registerCharacterProvider(runtimeHandle, provider)
        return {}
      }
    )
    rpc.handleHostRequest(
      'bridge.scrapers.characters.unregister',
      async ({ runtimeHandle, providerId }) => {
        await this.scrapers.unregisterCharacterProvider(runtimeHandle, providerId)
        return {}
      }
    )
    rpc.handleHostRequest('bridge.deeplinks.register', async ({ runtimeHandle, contribution }) => {
      this.deeplinks.register(runtimeHandle, contribution)
      return {}
    })
    rpc.handleHostRequest(
      'bridge.deeplinks.unregister',
      async ({ runtimeHandle, contributionId }) => {
        this.deeplinks.unregister(runtimeHandle, contributionId)
        return {}
      }
    )
    rpc.handleHostRequest('bridge.themes.register', async ({ runtimeHandle, theme }) => {
      this.themes.register(runtimeHandle, theme)
      return {}
    })
    rpc.handleHostRequest('bridge.themes.unregister', async ({ runtimeHandle, themeId }) => {
      this.themes.unregister(runtimeHandle, themeId)
      return {}
    })
  }

  async releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): Promise<void> {
    this.entityMenus.releaseRuntime(runtimeHandle)
    this.settingsPanels.releaseRuntime(runtimeHandle)
    this.themes.releaseRuntime(runtimeHandle)
    this.deeplinks.releaseRuntime(runtimeHandle)
    await this.scrapers.releaseRuntime(runtimeHandle)
  }

  async releaseAll(): Promise<void> {
    this.entityMenus.releaseAll()
    this.settingsPanels.releaseAll()
    this.themes.releaseAll()
    this.deeplinks.releaseAll()
    await this.scrapers.releaseAll()
  }

  getSnapshot(): ExtensionContributionSnapshot {
    return {
      entityMenus: this.entityMenus.getSnapshot(),
      settingsPanels: this.settingsPanels.getSnapshot(),
      themes: this.themes.getSnapshot(),
      deeplinks: this.deeplinks.getSnapshot(),
      scrapers: this.scrapers.getSnapshot()
    }
  }
}
