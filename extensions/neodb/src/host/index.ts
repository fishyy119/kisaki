import { defineExtension, kisaki, type ExtensionLogger } from '@kisaki3/extension-sdk'
import { SettingsStore } from './utils/settings-store'
import { NeodbClient } from './api/client'
import { NeodbOauthFlow } from './auth/oauth-flow'
import { SessionStore } from './auth/session-store'
import { createDefaultNeodbSettings } from './config/defaults'
import { normalizeNeodbSettings } from './config/schema'
import { m } from './i18n'
import { NeodbNovelProvider } from './media/novel/provider'
import { registerNeodbSettingsUi } from './settings'
import { SyncEngine } from './sync/engine'
import { SyncStateStore } from './sync/state'
import { SyncSubscription } from './sync/subscription'
import { NeodbTasks } from './tasks'
import { NeodbExtensionError, toSafeErrorLog } from './utils/errors'
import { NEODB_STORAGE_KEYS } from './utils/ids'

export default defineExtension({
  async activate(context) {
    const settingsStore = new SettingsStore(context.storage, NEODB_STORAGE_KEYS.settings, {
      normalize: normalizeNeodbSettings,
      createDefault: createDefaultNeodbSettings
    })
    const sessionStore = new SessionStore(context.secrets)
    await settingsStore.get()

    const client = new NeodbClient(
      kisaki.network,
      sessionStore,
      () => settingsStore.get(),
      context.logger
    )

    const oauthFlowRef: { current?: NeodbOauthFlow } = {}

    const deeplinkRegistration = context.contributions.deeplinkRoutes.register({
      id: 'oauth-callback',
      path: '/oauth-callback',
      async handle(event) {
        try {
          const oauthFlow = oauthFlowRef.current
          if (!oauthFlow) {
            throw new NeodbExtensionError('auth_cancelled', m().errors.loginNotReady)
          }

          await oauthFlow.completeFromDeeplink(event, context.abortSignal)
          const user = await client.getOwnUser({ signal: context.abortSignal })
          const userName = user.username?.trim() || 'unknown'
          await notifyLoginSuccess(userName, context.logger)
          return {
            success: true,
            status: 'handled',
            message: m().oauth.loginCompleted({ userName })
          }
        } catch (error) {
          const message = toUserMessage(error)
          context.logger.warn('NeoDB OAuth callback failed.', toSafeErrorLog(error))
          await notifyLoginFailure(message, context.logger)
          return { success: false, status: 'error', message }
        }
      }
    })

    const oauthFlow = new NeodbOauthFlow({
      network: kisaki.network,
      store: sessionStore,
      settingsStore,
      callbackUrl: deeplinkRegistration.urlPattern,
      openExternal: (url) => kisaki.runtime.openExternal(url),
      logger: context.logger
    })
    oauthFlowRef.current = oauthFlow

    const syncStateStore = new SyncStateStore(context.storage)
    const syncEngine = new SyncEngine({
      settingsStore,
      client,
      stateStore: syncStateStore
    })
    const tasks = new NeodbTasks({
      client,
      engine: syncEngine,
      logger: context.logger
    })

    context.logger.info('Built-in NeoDB integration activated.')

    context.subscriptions.add(deeplinkRegistration)
    context.subscriptions.add(
      context.contributions.scraperProviders.novel.register(
        new NeodbNovelProvider(client, () => settingsStore.get())
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

    registerNeodbSettingsUi(context, {
      settingsStore,
      sessionStore,
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
    logger.warn('NeoDB OAuth success notification failed.', toSafeErrorLog(error))
  }
}

async function notifyLoginFailure(message: string, logger: ExtensionLogger): Promise<void> {
  try {
    await kisaki.notify.error(m().oauth.loginFailedTitle, { message })
  } catch (error) {
    logger.warn('NeoDB OAuth failure notification failed.', toSafeErrorLog(error))
  }
}

function toUserMessage(error: unknown): string {
  if (error instanceof NeodbExtensionError) {
    return error.message
  }

  return m().oauth.callbackFailed
}
