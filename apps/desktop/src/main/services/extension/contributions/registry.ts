import type { ExtensionRuntimeHandle } from '@kisaki/extension-api'
import type { ExtensionContributionSnapshot } from '@shared/extension'
import type { ExtensionHostRpcClient } from '../runtime/rpc-client'
import { ExtensionCommandContributionHost } from './commands'
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
  readonly commands: ExtensionCommandContributionHost

  constructor(private readonly options: ExtensionContributionHostOptions) {
    this.entityMenus = new ExtensionEntityMenuContributionHost(options)
    this.settings = new ExtensionSettingsContributionHost(options)
    this.themes = new ExtensionThemeContributionHost(options)
    this.deeplinks = new ExtensionDeeplinkContributionHost(options)
    this.scrapers = new ExtensionScraperContributionHost(options)
    this.commands = new ExtensionCommandContributionHost(options)
  }

  registerRpcHandlers(rpc: ExtensionHostRpcClient): void {
    rpc.handleHostRequest(
      'contributions.entityMenus.register',
      async ({ runtimeHandle, contribution }) => {
        this.entityMenus.register(runtimeHandle, contribution)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.entityMenus.unregister',
      async ({ runtimeHandle, contributionId }) => {
        this.entityMenus.unregister(runtimeHandle, contributionId)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.settings.register',
      async ({ runtimeHandle, contribution }) => {
        this.settings.register(runtimeHandle, contribution)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.settings.unregister',
      async ({ runtimeHandle, contributionId }) => {
        this.settings.unregister(runtimeHandle, contributionId)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.scrapers.games.register',
      async ({ runtimeHandle, provider }) => {
        await this.scrapers.registerGameProvider(runtimeHandle, provider)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.scrapers.games.unregister',
      async ({ runtimeHandle, providerId }) => {
        await this.scrapers.unregisterGameProvider(runtimeHandle, providerId)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.scrapers.persons.register',
      async ({ runtimeHandle, provider }) => {
        await this.scrapers.registerPersonProvider(runtimeHandle, provider)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.scrapers.persons.unregister',
      async ({ runtimeHandle, providerId }) => {
        await this.scrapers.unregisterPersonProvider(runtimeHandle, providerId)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.scrapers.companies.register',
      async ({ runtimeHandle, provider }) => {
        await this.scrapers.registerCompanyProvider(runtimeHandle, provider)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.scrapers.companies.unregister',
      async ({ runtimeHandle, providerId }) => {
        await this.scrapers.unregisterCompanyProvider(runtimeHandle, providerId)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.scrapers.characters.register',
      async ({ runtimeHandle, provider }) => {
        await this.scrapers.registerCharacterProvider(runtimeHandle, provider)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.scrapers.characters.unregister',
      async ({ runtimeHandle, providerId }) => {
        await this.scrapers.unregisterCharacterProvider(runtimeHandle, providerId)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.deeplinks.register',
      async ({ runtimeHandle, contribution }) => {
        this.deeplinks.register(runtimeHandle, contribution)
        this.notifyChanged()
        return {}
      }
    )
    rpc.handleHostRequest(
      'contributions.deeplinks.unregister',
      async ({ runtimeHandle, contributionId }) => {
        this.deeplinks.unregister(runtimeHandle, contributionId)
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
      this.settings.releaseRuntime(runtimeHandle)
      this.themes.releaseRuntime(runtimeHandle)
      this.deeplinks.releaseRuntime(runtimeHandle)
      await this.scrapers.releaseRuntime(runtimeHandle)
      this.commands.releaseRuntime(runtimeHandle)
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
      this.commands.releaseAll()
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
