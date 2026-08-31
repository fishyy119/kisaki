import { defineExtension, kisaki, type ExtensionLogger } from '@kisaki3/extension-sdk'
import { OAuthRelayClient, OAuthRelayFlow } from './auth/oauth-relay'
import { SettingsStore } from './utils/settings-store'
import { GbooksClient } from './api/client'
import { TokenService } from './auth/token-service'
import { TokenStore } from './auth/token-store'
import { createDefaultGbooksSettings } from './config/defaults'
import { normalizeGbooksSettings } from './config/schema'
import { m } from './i18n'
import { registerGbooksJobCommands } from './jobs/commands'
import { GbooksNovelProvider } from './media/novel/provider'
import { registerGbooksSettingsUi, type GbooksSettingsUiHandle } from './settings'
import { GbooksTasks } from './tasks'
import { GBOOKS_LOGIN_TIMEOUT_MS, GBOOKS_OAUTH_RELAY_BASE_URL } from './utils/constants'
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
      getBaseUrl: async () => GBOOKS_OAUTH_RELAY_BASE_URL,
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
    const settingsUiRef: { current?: GbooksSettingsUiHandle } = {}

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
          settingsUiRef.current?.notifyOauthSettled('completed')
          await notifyLoginSuccess(context.logger)
          return {
            success: true,
            status: 'handled',
            message: m().oauth.loginCompleted
          }
        } catch (error) {
          const message = toUserMessage(error)
          context.logger.warn('Google Books OAuth callback failed.', toSafeErrorLog(error))
          // A failed attempt can still consume the pending session, so the
          // open dialog must re-read account state as well.
          settingsUiRef.current?.notifyOauthSettled('failed')
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
    for (const registration of registerGbooksJobCommands({
      commands: context.contributions.commands,
      tasks,
      signal: context.abortSignal,
      logger: context.logger
    })) {
      context.subscriptions.add(registration)
    }

    settingsUiRef.current = registerGbooksSettingsUi(context, {
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
