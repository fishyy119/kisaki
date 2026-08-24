import { defineExtension, kisaki } from '@kisaki3/extension-sdk'
import { IgdbClient } from './api/client'
import { CredentialStore } from './auth/credentials'
import { SettingsStore } from './config/store'
import { setHostUiLocale } from './i18n'
import { IgdbCompanyProvider } from './media/company/provider'
import { IgdbGameProvider } from './media/game/provider'
import type { IgdbRuntime } from './media/runtime'
import { registerIgdbSettingsUi } from './settings'

export default defineExtension({
  async activate(context) {
    setHostUiLocale((await kisaki.runtime.getInfo()).uiLocale)
    context.hooks.on('app.ui-locale.changed', ({ effective }) => {
      setHostUiLocale(effective)
    })

    const settingsStore = new SettingsStore(context.storage)
    const credentials = new CredentialStore(context.secrets)
    await settingsStore.get()

    const client = new IgdbClient(
      kisaki.network,
      credentials,
      () => settingsStore.get(),
      context.logger
    )
    const runtime: IgdbRuntime = { client, getSettings: () => settingsStore.get() }

    // Providers register regardless of credentials: the user configures the
    // Twitch client from the extension settings, and until then each call
    // fails with a message naming exactly what is missing.
    context.subscriptions.add(
      context.contributions.scraperProviders.game.register(new IgdbGameProvider(runtime))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.company.register(new IgdbCompanyProvider(runtime))
    )

    registerIgdbSettingsUi(context, {
      settingsStore,
      credentials,
      client,
      logger: context.logger,
      abortSignal: context.abortSignal
    })

    context.logger.info('Built-in IGDB integration activated.')
  }
})
