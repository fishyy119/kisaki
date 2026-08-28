import { defineExtension, kisaki, SettingsStore } from '@kisaki3/extension-sdk'
import { TmdbClient } from './api/client'
import { ApiKeyStore } from './auth/api-key'
import { createDefaultTmdbSettings } from './config/defaults'
import { normalizeTmdbSettings } from './config/schema'
import { setHostUiLocale } from './i18n'
import { TmdbAnimeProvider } from './media/anime/provider'
import { TmdbCompanyProvider } from './media/company/provider'
import { TmdbPersonProvider } from './media/person/provider'
import type { TmdbRuntime } from './media/runtime'
import { registerTmdbSettingsUi } from './settings'
import { TMDB_STORAGE_KEYS } from './utils/ids'

export default defineExtension({
  async activate(context) {
    setHostUiLocale((await kisaki.runtime.getInfo()).uiLocale)
    context.hooks.on('app.ui-locale.changed', ({ effective }) => {
      setHostUiLocale(effective)
    })

    const settingsStore = new SettingsStore(context.storage, TMDB_STORAGE_KEYS.settings, {
      normalize: normalizeTmdbSettings,
      createDefault: createDefaultTmdbSettings
    })
    const apiKeys = new ApiKeyStore(context.secrets)
    await settingsStore.get()

    const client = new TmdbClient(
      kisaki.network,
      apiKeys,
      () => settingsStore.get(),
      context.logger
    )
    const runtime: TmdbRuntime = { client, getSettings: () => settingsStore.get() }

    context.subscriptions.add(
      context.contributions.scraperProviders.anime.register(new TmdbAnimeProvider(runtime))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.person.register(new TmdbPersonProvider(runtime))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.company.register(new TmdbCompanyProvider(runtime))
    )

    registerTmdbSettingsUi(context, {
      settingsStore,
      apiKeys,
      client,
      logger: context.logger,
      abortSignal: context.abortSignal
    })

    context.logger.info('Built-in TMDB integration activated.')
  }
})
