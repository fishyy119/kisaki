import type { ExtensionRuntimeHandle } from '@kisaki/extension-api'
import type { ExtensionContributionSnapshot } from '@shared/extension'
import type { ExtensionHostRpcClient } from '../runtime/rpc-client'
import { ExtensionDeeplinkContributionHost } from './deeplinks'
import { ExtensionEntityMenuContributionHost } from './entity-menus'
import { ExtensionScraperContributionHost } from './scrapers'
import { ExtensionSettingsContributionHost } from './settings'
import { ExtensionThemeContributionHost } from './themes'
import type { ExtensionContributionHostOptions } from './types'

export class ExtensionContributionRegistry {
  readonly entityMenus: ExtensionEntityMenuContributionHost
  readonly settings: ExtensionSettingsContributionHost
  readonly themes: ExtensionThemeContributionHost
  readonly deeplinks: ExtensionDeeplinkContributionHost
  readonly scrapers: ExtensionScraperContributionHost

  constructor(private readonly options: ExtensionContributionHostOptions) {
    this.entityMenus = new ExtensionEntityMenuContributionHost(options)
    this.settings = new ExtensionSettingsContributionHost(options)
    this.themes = new ExtensionThemeContributionHost(options)
    this.deeplinks = new ExtensionDeeplinkContributionHost(options)
    this.scrapers = new ExtensionScraperContributionHost(options)
  }

  registerRpcHandlers(rpc: ExtensionHostRpcClient): void {
    rpc.handleHostRequest(
      'bridge.entityMenus.register',
      async ({ runtimeHandle, contribution }) => {
        this.entityMenus.register(runtimeHandle, contribution)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'bridge.entityMenus.unregister',
      async ({ runtimeHandle, contributionId }) => {
        this.entityMenus.unregister(runtimeHandle, contributionId)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest('bridge.settings.register', async ({ runtimeHandle, contribution }) => {
      this.settings.register(runtimeHandle, contribution)
      this.notifyChanged()
      return {}
    })
    rpc.handleHostRequest(
      'bridge.settings.unregister',
      async ({ runtimeHandle, contributionId }) => {
        this.settings.unregister(runtimeHandle, contributionId)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest('bridge.scrapers.games.register', async ({ runtimeHandle, provider }) => {
      await this.scrapers.registerGameProvider(runtimeHandle, provider)
      this.notifyChanged()
      return {}
    })
    rpc.handleHostRequest(
      'bridge.scrapers.games.unregister',
      async ({ runtimeHandle, providerId }) => {
        await this.scrapers.unregisterGameProvider(runtimeHandle, providerId)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'bridge.scrapers.persons.register',
      async ({ runtimeHandle, provider }) => {
        await this.scrapers.registerPersonProvider(runtimeHandle, provider)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'bridge.scrapers.persons.unregister',
      async ({ runtimeHandle, providerId }) => {
        await this.scrapers.unregisterPersonProvider(runtimeHandle, providerId)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'bridge.scrapers.companies.register',
      async ({ runtimeHandle, provider }) => {
        await this.scrapers.registerCompanyProvider(runtimeHandle, provider)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'bridge.scrapers.companies.unregister',
      async ({ runtimeHandle, providerId }) => {
        await this.scrapers.unregisterCompanyProvider(runtimeHandle, providerId)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'bridge.scrapers.characters.register',
      async ({ runtimeHandle, provider }) => {
        await this.scrapers.registerCharacterProvider(runtimeHandle, provider)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'bridge.scrapers.characters.unregister',
      async ({ runtimeHandle, providerId }) => {
        await this.scrapers.unregisterCharacterProvider(runtimeHandle, providerId)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest('bridge.deeplinks.register', async ({ runtimeHandle, contribution }) => {
      this.deeplinks.register(runtimeHandle, contribution)
      this.notifyChanged()
      return {}
    })
    rpc.handleHostRequest(
      'bridge.deeplinks.unregister',
      async ({ runtimeHandle, contributionId }) => {
        this.deeplinks.unregister(runtimeHandle, contributionId)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest('bridge.themes.register', async ({ runtimeHandle, theme }) => {
      this.themes.register(runtimeHandle, theme)
      this.notifyChanged()
      return {}
    })
    rpc.handleHostRequest('bridge.themes.unregister', async ({ runtimeHandle, themeId }) => {
      this.themes.unregister(runtimeHandle, themeId)
      this.notifyChanged()
      return {}
    })
  }

  async releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): Promise<void> {
    try {
      this.entityMenus.releaseRuntime(runtimeHandle)
      this.settings.releaseRuntime(runtimeHandle)
      this.themes.releaseRuntime(runtimeHandle)
      this.deeplinks.releaseRuntime(runtimeHandle)
      await this.scrapers.releaseRuntime(runtimeHandle)
    } finally {
      this.notifyChanged()
    }
  }

  async releaseAll(): Promise<void> {
    try {
      this.entityMenus.releaseAll()
      this.settings.releaseAll()
      this.themes.releaseAll()
      this.deeplinks.releaseAll()
      await this.scrapers.releaseAll()
    } finally {
      this.notifyChanged()
    }
  }

  getSnapshot(): ExtensionContributionSnapshot {
    return {
      entityMenus: this.entityMenus.getSnapshot(),
      settings: this.settings.getSnapshot(),
      themes: this.themes.getSnapshot(),
      deeplinks: this.deeplinks.getSnapshot(),
      scrapers: this.scrapers.getSnapshot()
    }
  }

  private notifyChanged(): void {
    this.options.onDidChange?.()
  }
}
