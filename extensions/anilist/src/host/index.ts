import { defineExtension, kisaki, type ExtensionLogger } from '@kisaki3/extension-sdk'
import { OAuthRelayClient, OAuthRelayFlow } from './auth/oauth-relay'
import { SettingsStore } from './utils/settings-store'
import { AnilistClient } from './api/client'
import { TokenStore } from './auth/token-store'
import { createDefaultAnilistSettings } from './config/defaults'
import { normalizeAnilistSettings } from './config/schema'
import { m } from './i18n'
import { AnilistCharacterProvider } from './media/character/provider'
import {
  AnilistAnimeProvider,
  AnilistComicProvider,
  AnilistNovelProvider
} from './media/media-providers'
import { AnilistPersonProvider } from './media/person/provider'
import type { AnilistRuntime } from './media/runtime'
import { registerAnilistSettingsUi } from './settings'
import { SyncEngine } from './sync/engine'
import { SyncStateStore } from './sync/state'
import { SyncSubscription } from './sync/subscription'
import { AnilistTasks } from './tasks'
import { ANILIST_LOGIN_TIMEOUT_MS } from './utils/constants'
import { AnilistExtensionError, createRelayError, toSafeErrorLog } from './utils/errors'
import { ANILIST_STORAGE_KEYS } from './utils/ids'

export default defineExtension({
  async activate(context) {
    const settingsStore = new SettingsStore(context.storage, ANILIST_STORAGE_KEYS.settings, {
      normalize: normalizeAnilistSettings,
      createDefault: createDefaultAnilistSettings
    })
    const tokenStore = new TokenStore(context.secrets)
    await settingsStore.get()

    const client = new AnilistClient(
      kisaki.network,
      tokenStore,
      () => settingsStore.get(),
      context.logger
    )
    const runtime: AnilistRuntime = { client, getSettings: () => settingsStore.get() }

    const relayClient = new OAuthRelayClient({
      network: kisaki.network,
      getBaseUrl: async () => (await settingsStore.get()).endpoints.oauthRelayUrl,
      getTimeoutMs: async () => (await settingsStore.get()).client.timeoutMs,
      createError: createRelayError
    })

    const oauthFlowRef: { current?: OAuthRelayFlow } = {}

    const deeplinkRegistration = context.contributions.deeplinkRoutes.register({
      id: 'oauth-callback',
      path: '/oauth-callback',
      async handle(event) {
        try {
          const oauthFlow = oauthFlowRef.current
          if (!oauthFlow) {
            throw new AnilistExtensionError('relay_unavailable', m().errors.loginNotReady)
          }

          await oauthFlow.completeFromDeeplink(event)
          const viewer = await client.getViewer({ signal: context.abortSignal })
          const userName = viewer.name?.trim() || String(viewer.id)
          await notifyLoginSuccess(userName, context.logger)
          return {
            success: true,
            status: 'handled',
            message: m().oauth.loginCompleted({ userName })
          }
        } catch (error) {
          const message = toUserMessage(error)
          context.logger.warn('AniList OAuth callback failed.', toSafeErrorLog(error))
          await notifyLoginFailure(message, context.logger)
          return { success: false, status: 'error', message }
        }
      }
    })

    const oauthFlow = new OAuthRelayFlow({
      client: relayClient,
      store: tokenStore,
      callbackUrl: deeplinkRegistration.urlPattern,
      openExternal: (url) => kisaki.runtime.openExternal(url),
      getLoginTimeoutMs: async () => ANILIST_LOGIN_TIMEOUT_MS,
      createError: createRelayError,
      logger: context.logger
    })
    oauthFlowRef.current = oauthFlow

    const syncStateStore = new SyncStateStore(context.storage)
    const syncEngine = new SyncEngine({
      settingsStore,
      client,
      stateStore: syncStateStore,
      logger: context.logger
    })
    const tasks = new AnilistTasks({
      client,
      engine: syncEngine,
      logger: context.logger
    })

    context.logger.info('Built-in AniList integration activated.')

    context.subscriptions.add(deeplinkRegistration)
    context.subscriptions.add(
      context.contributions.scraperProviders.anime.register(new AnilistAnimeProvider(runtime))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.comic.register(new AnilistComicProvider(runtime))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.novel.register(new AnilistNovelProvider(runtime))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.person.register(new AnilistPersonProvider(runtime))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.character.register(
        new AnilistCharacterProvider(runtime)
      )
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

    registerAnilistSettingsUi(context, {
      settingsStore,
      tokenStore,
      client,
      oauthFlow,
      tasks,
      logger: context.logger,
      abortSignal: context.abortSignal
    })
  }
})

async function notifyLoginSuccess(userName: string, logger: ExtensionLogger): Promise<void> {
  try {
    await kisaki.notify.success(m().oauth.loginSucceededTitle, {
      message: m().oauth.loginCompleted({ userName })
    })
  } catch (error) {
    logger.warn('AniList OAuth success notification failed.', toSafeErrorLog(error))
  }
}

async function notifyLoginFailure(message: string, logger: ExtensionLogger): Promise<void> {
  try {
    await kisaki.notify.error(m().oauth.loginFailedTitle, { message })
  } catch (error) {
    logger.warn('AniList OAuth failure notification failed.', toSafeErrorLog(error))
  }
}

function toUserMessage(error: unknown): string {
  if (error instanceof AnilistExtensionError) {
    return error.message
  }

  return m().oauth.callbackFailed
}
