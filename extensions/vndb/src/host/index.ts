import { defineExtension, kisaki } from '@kisaki3/extension-sdk'
import { VndbClient } from './api/client'
import { TokenStore } from './auth/token'
import { SettingsStore } from './config/store'
import { setHostUiLocale } from './i18n'
import { VndbCharacterProvider } from './media/character/provider'
import { VndbCompanyProvider } from './media/company/provider'
import { VndbGameProvider } from './media/game/provider'
import { VndbPersonProvider } from './media/person/provider'
import type { VndbRuntime } from './media/runtime'
import { registerVndbSettingsUi } from './settings'

export default defineExtension({
  async activate(context) {
    setHostUiLocale((await kisaki.runtime.getInfo()).uiLocale)
    context.hooks.on('app.ui-locale.changed', ({ effective }) => {
      setHostUiLocale(effective)
    })

    const settingsStore = new SettingsStore(context.storage)
    const tokens = new TokenStore(context.secrets)
    await settingsStore.get()

    const client = new VndbClient(kisaki.network, tokens, () => settingsStore.get(), context.logger)
    const runtime: VndbRuntime = { client, getSettings: () => settingsStore.get() }

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

    registerVndbSettingsUi(context, {
      settingsStore,
      tokens,
      client,
      logger: context.logger,
      abortSignal: context.abortSignal
    })

    context.logger.info('Built-in VNDB integration activated.')
  }
})
