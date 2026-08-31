import { defineExtension, kisaki } from '@kisaki3/extension-sdk'
import { SettingsStore } from './utils/settings-store'
import { VndbClient } from './api/client'
import { TokenStore } from './auth/token'
import { createDefaultVndbSettings } from './config/defaults'
import { normalizeVndbSettings } from './config/schema'
import { registerVndbJobCommands } from './jobs/commands'
import { VndbCharacterProvider } from './media/character/provider'
import { VndbCompanyProvider } from './media/company/provider'
import { VndbGameProvider } from './media/game/provider'
import { VndbPersonProvider } from './media/person/provider'
import type { VndbRuntime } from './media/runtime'
import { registerVndbSettingsUi } from './settings'
import { SyncEngine } from './sync/engine'
import { SyncStateStore } from './sync/state'
import { SyncSubscription } from './sync/subscription'
import { VndbTasks } from './tasks'
import { VNDB_STORAGE_KEYS } from './utils/ids'

export default defineExtension({
  async activate(context) {
    const settingsStore = new SettingsStore(context.storage, VNDB_STORAGE_KEYS.settings, {
      normalize: normalizeVndbSettings,
      createDefault: createDefaultVndbSettings
    })
    const tokens = new TokenStore(context.secrets)
    await settingsStore.get()

    const client = new VndbClient(kisaki.network, tokens, () => settingsStore.get(), context.logger)
    const runtime: VndbRuntime = { client, getSettings: () => settingsStore.get() }

    const syncStateStore = new SyncStateStore(context.storage)
    const syncEngine = new SyncEngine({
      settingsStore,
      client,
      stateStore: syncStateStore,
      logger: context.logger
    })
    const tasks = new VndbTasks({
      client,
      engine: syncEngine,
      logger: context.logger
    })

    context.subscriptions.add(
      context.contributions.scraperProviders.game.register(new VndbGameProvider(runtime))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.character.register(new VndbCharacterProvider(runtime))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.person.register(new VndbPersonProvider(runtime))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.company.register(new VndbCompanyProvider(runtime))
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
    for (const registration of registerVndbJobCommands({
      commands: context.contributions.commands,
      tasks,
      client,
      tokens,
      signal: context.abortSignal,
      logger: context.logger
    })) {
      context.subscriptions.add(registration)
    }

    registerVndbSettingsUi(context, {
      settingsStore,
      tokens,
      client,
      tasks,
      logger: context.logger,
      abortSignal: context.abortSignal
    })

    context.logger.info('Built-in VNDB integration activated.')
  }
})
