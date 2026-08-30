import { defineExtension, kisaki } from '@kisaki3/extension-sdk'
import { SettingsStore } from './utils/settings-store'
import { YmgalClient } from './api/client'
import { CredentialStore } from './auth/credentials'
import { createDefaultYmgalSettings } from './config/defaults'
import { normalizeYmgalSettings } from './config/schema'
import { YmgalCharacterProvider } from './media/character/provider'
import { YmgalCompanyProvider } from './media/company/provider'
import { YmgalGameProvider } from './media/game/provider'
import { YmgalPersonProvider } from './media/person/provider'
import type { YmgalRuntime } from './media/runtime'
import { registerYmgalSettingsUi } from './settings'
import { YMGAL_STORAGE_KEYS } from './utils/ids'

export default defineExtension({
  async activate(context) {
    const settingsStore = new SettingsStore(context.storage, YMGAL_STORAGE_KEYS.settings, {
      normalize: normalizeYmgalSettings,
      createDefault: createDefaultYmgalSettings
    })
    const credentials = new CredentialStore(context.secrets)
    await settingsStore.get()

    const client = new YmgalClient(
      kisaki.network,
      credentials,
      () => settingsStore.get(),
      context.logger
    )
    const runtime: YmgalRuntime = { client, getSettings: () => settingsStore.get() }

    context.subscriptions.add(
      context.contributions.scraperProviders.game.register(new YmgalGameProvider(runtime))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.company.register(new YmgalCompanyProvider(runtime))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.person.register(new YmgalPersonProvider(runtime))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.character.register(new YmgalCharacterProvider(runtime))
    )

    registerYmgalSettingsUi(context, {
      settingsStore,
      credentials,
      client,
      logger: context.logger,
      abortSignal: context.abortSignal
    })

    context.logger.info('Built-in YMGal integration activated.')
  }
})
