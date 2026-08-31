import { defineExtension, kisaki } from '@kisaki3/extension-sdk'
import { SettingsStore } from './utils/settings-store'
import { MangadexClient } from './api/client'
import { CredentialsStore } from './auth/credentials-store'
import { TokenManager } from './auth/token-manager'
import { createDefaultMangadexSettings } from './config/defaults'
import { normalizeMangadexSettings } from './config/schema'
import { registerMangadexJobCommands } from './jobs/commands'
import { MangadexComicProvider } from './media/comic/provider'
import { MangadexPersonProvider } from './media/person/provider'
import { registerMangadexSettingsUi } from './settings'
import { SyncEngine } from './sync/engine'
import { SyncStateStore } from './sync/state'
import { SyncSubscription } from './sync/subscription'
import { MangadexTasks } from './tasks'
import { MANGADEX_STORAGE_KEYS } from './utils/ids'

export default defineExtension({
  async activate(context) {
    const settingsStore = new SettingsStore(context.storage, MANGADEX_STORAGE_KEYS.settings, {
      normalize: normalizeMangadexSettings,
      createDefault: createDefaultMangadexSettings
    })
    const credentialsStore = new CredentialsStore(context.secrets)
    await settingsStore.get()

    const tokenManager = new TokenManager(kisaki.network, credentialsStore, context.logger)
    const client = new MangadexClient(
      kisaki.network,
      tokenManager,
      () => settingsStore.get(),
      context.logger
    )

    const syncStateStore = new SyncStateStore(context.storage)
    const syncEngine = new SyncEngine({
      settingsStore,
      client,
      stateStore: syncStateStore
    })
    const tasks = new MangadexTasks({
      client,
      engine: syncEngine,
      logger: context.logger
    })

    context.logger.info('Built-in MangaDex integration activated.')

    context.subscriptions.add(
      context.contributions.scraperProviders.comic.register(
        new MangadexComicProvider(client, () => settingsStore.get())
      )
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.person.register(new MangadexPersonProvider(client))
    )
    context.subscriptions.add(
      new SyncSubscription({
        hooks: context.hooks,
        selfActor: `extension:${context.extension.id}`,
        settingsStore,
        engine: syncEngine,
        logger: context.logger
      }).start()
    )
    for (const registration of registerMangadexJobCommands({
      commands: context.contributions.commands,
      tasks,
      client,
      tokenManager,
      signal: context.abortSignal,
      logger: context.logger
    })) {
      context.subscriptions.add(registration)
    }

    registerMangadexSettingsUi(context, {
      settingsStore,
      credentialsStore,
      tokenManager,
      client,
      tasks,
      logger: context.logger,
      abortSignal: context.abortSignal
    })
  }
})
