import { defineExtension, kisaki } from '@kisaki3/extension-sdk'
import { SettingsStore } from './utils/settings-store'
import { SgdbClient } from './api/client'
import { createDefaultSgdbSettings } from './config/defaults'
import { normalizeSgdbSettings } from './config/schema'
import { SgdbGameProvider } from './media/game/provider'
import { registerSgdbSettingsUi } from './settings'
import { SGDB_STORAGE_KEYS } from './utils/ids'

export default defineExtension({
  async activate(context) {
    const settingsStore = new SettingsStore(context.storage, SGDB_STORAGE_KEYS.settings, {
      normalize: normalizeSgdbSettings,
      createDefault: createDefaultSgdbSettings
    })
    await settingsStore.get()

    const client = new SgdbClient(
      kisaki.network,
      context.secrets,
      () => settingsStore.get(),
      context.logger
    )

    context.logger.info('Built-in SteamGridDB integration activated.')

    context.subscriptions.add(
      context.contributions.scraperProviders.game.register(new SgdbGameProvider(client))
    )

    registerSgdbSettingsUi(context, {
      settingsStore,
      client,
      logger: context.logger,
      abortSignal: context.abortSignal
    })
  }
})
