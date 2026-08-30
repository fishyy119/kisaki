import { defineExtension, kisaki, type ExtensionLogger } from '@kisaki3/extension-sdk'
import { OAuthRelayClient, OAuthRelayFlow } from './auth/oauth-relay'
import { SettingsStore } from './utils/settings-store'
import { GbooksClient } from './api/client'
import { TokenService } from './auth/token-service'
import { TokenStore } from './auth/token-store'
import { createDefaultGbooksSettings } from './config/defaults'
import { normalizeGbooksSettings } from './config/schema'
import { m } from './i18n'
import { GbooksNovelProvider } from './media/novel/provider'
import { registerGbooksSettingsUi } from './settings'
import { GbooksTasks } from './tasks'
import { GBOOKS_LOGIN_TIMEOUT_MS } from './utils/constants'
import { GbooksExtensionError, createRelayError, toSafeErrorLog } from './utils/errors'
import { GBOOKS_STORAGE_KEYS } from './utils/ids'

export default defineExtension({
  async activate(context) {
    const settingsStore = new SettingsStore(context.storage, GBOOKS_STORAGE_KEYS.settings, {
      normalize: normalizeGbooksSettings,
      createDefault: createDefaultGbooksSettings
    })
    const tokenStore = new TokenStore(context.secrets)
    await settingsStore.get()

    const relayClient = new OAuthRelayClient({
      network: kisaki.network,
      getBaseUrl: async () => (await settingsStore.get()).endpoints.oauthRelayUrl,
      getTimeoutMs: async () => (await settingsStore.get()).client.timeoutMs,
      createError: createRelayError
    })
    const tokenService = new TokenService(tokenStore, relayClient, context.logger)
    const client = new GbooksClient(
      kisaki.network,
      tokenService,
      tokenStore,
      () => settingsStore.get(),
      context.logger
    )

    const oauthFlowRef: { current?: OAuthRelayFlow } = {}

    const deeplinkRegistration = context.contributions.deeplinkRoutes.register({
      id: 'oauth-callback',
      path: '/oauth-callback',
      async handle(event) {
        try {
          const oauthFlow = oauthFlowRef.current
          if (!oauthFlow) {
            throw new GbooksExtensionError('relay_unavailable', m().errors.loginNotReady)
          }

          await oauthFlow.completeFromDeeplink(event)
          await notifyLoginSuccess(context.logger)
          return {
            success: true,
            status: 'handled',
            message: m().oauth.loginCompleted
          }
        } catch (error) {
          const message = toUserMessage(error)
          context.logger.warn('Google Books OAuth callback failed.', toSafeErrorLog(error))
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
      getLoginTimeoutMs: async () => GBOOKS_LOGIN_TIMEOUT_MS,
      createError: createRelayError,
      logger: context.logger
    })
    oauthFlowRef.current = oauthFlow

    const tasks = new GbooksTasks({ client, logger: context.logger })

    context.logger.info('Built-in Google Books integration activated.')

    context.subscriptions.add(deeplinkRegistration)
    context.subscriptions.add(
      context.contributions.scraperProviders.novel.register(new GbooksNovelProvider(client))
    )

    registerGbooksSettingsUi(context, {
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

async function notifyLoginSuccess(logger: ExtensionLogger): Promise<void> {
  try {
    await kisaki.notify.success(m().oauth.loginSucceededTitle, {
      message: m().oauth.loginCompleted
    })
  } catch (error) {
    logger.warn('Google Books OAuth success notification failed.', toSafeErrorLog(error))
  }
}

async function notifyLoginFailure(message: string, logger: ExtensionLogger): Promise<void> {
  try {
    await kisaki.notify.error(m().oauth.loginFailedTitle, { message })
  } catch (error) {
    logger.warn('Google Books OAuth failure notification failed.', toSafeErrorLog(error))
  }
}

function toUserMessage(error: unknown): string {
  if (error instanceof GbooksExtensionError) {
    return error.message
  }

  return m().oauth.callbackFailed
}
