import { defineExtension, kisaki } from '@kisaki3/extension-sdk'
import { SettingsStore } from './utils/settings-store'
import { AppDetailsCache } from './api/cache'
import { SteamClient } from './api/client'
import { createDefaultSteamSettings } from './config/defaults'
import { normalizeSteamSettings } from './config/schema'
import { SteamGameProvider } from './media/game/provider'
import { registerSteamSettingsUi } from './settings'
import { SteamTasks } from './tasks'
import { STEAM_STORAGE_KEYS } from './utils/ids'

export default defineExtension({
  async activate(context) {
    const settingsStore = new SettingsStore(context.storage, STEAM_STORAGE_KEYS.settings, {
      normalize: normalizeSteamSettings,
      createDefault: createDefaultSteamSettings
    })
    await settingsStore.get()

    const cache = new AppDetailsCache(context.storage)
    const client = new SteamClient(
      kisaki.network,
      context.secrets,
      cache,
      () => settingsStore.get(),
      context.logger
    )
    const tasks = new SteamTasks({ client, logger: context.logger })

    context.logger.info('Built-in Steam integration activated.')

    context.subscriptions.add(
      context.contributions.scraperProviders.game.register(new SteamGameProvider(client))
    )

    registerSteamSettingsUi(context, {
      settingsStore,
      client,
      tasks,
      logger: context.logger,
      abortSignal: context.abortSignal
    })
  }
})
