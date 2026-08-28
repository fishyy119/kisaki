import { defineExtension, kisaki, SettingsStore } from '@kisaki3/extension-sdk'
import { MangadexClient } from './api/client'
import { CredentialsStore } from './auth/credentials-store'
import { TokenManager } from './auth/token-manager'
import { createDefaultMangadexSettings } from './config/defaults'
import { normalizeMangadexSettings } from './config/schema'
import { setHostUiLocale } from './i18n'
import { MangadexComicProvider } from './media/comic/provider'
import { MangadexPersonProvider } from './media/person/provider'
import { registerMangadexSettingsUi } from './settings'
import { SyncEngine } from './sync/engine'
import { SyncStateStore } from './sync/state'
import { SyncSubscription } from './sync/subscription'
import { SyncSuppressor } from './sync/suppressor'
import { MangadexTasks } from './tasks'
import { MANGADEX_STORAGE_KEYS } from './utils/ids'

export default defineExtension({
  async activate(context) {
    setHostUiLocale((await kisaki.runtime.getInfo()).uiLocale)
    context.hooks.on('app.ui-locale.changed', ({ effective }) => {
      setHostUiLocale(effective)
    })

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
    const syncSuppressor = new SyncSuppressor()
    const syncEngine = new SyncEngine({
      settingsStore,
      client,
      stateStore: syncStateStore,
      suppressor: syncSuppressor
    })
    const tasks = new MangadexTasks({
      client,
      engine: syncEngine,
      suppressor: syncSuppressor,
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
        settingsStore,
        engine: syncEngine,
        logger: context.logger
      }).start()
    )

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
