import { defineExtension, kisaki } from '@kisaki/extension-sdk'
import { BangumiClient } from './api/client'
import { TokenStore } from './auth/token-store'
import { SettingsStore } from './config/store'
import { BangumiProvider } from './scraper/provider'
import { createBangumiSettingsPanel } from './ui/settings'

export default defineExtension({
  async activate(context) {
    const settingsStore = new SettingsStore(context.storage)
    const tokenStore = new TokenStore(context.secrets)
    await settingsStore.get()

    const client = new BangumiClient(
      kisaki.network,
      () => tokenStore.getAccessToken(),
      async () => (await settingsStore.get()).client.rateLimit
    )

    context.logger.info('Built-in Bangumi integration activated.')

    context.subscriptions.add(
      context.contributions.scraperProviders.game.register(new BangumiProvider(client))
    )
    context.subscriptions.add(
      context.contributions.settingsPanels.register(
        createBangumiSettingsPanel({ settingsStore, tokenStore })
      )
    )
  }
})
