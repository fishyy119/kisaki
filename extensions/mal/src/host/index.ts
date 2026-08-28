import {
  defineExtension,
  kisaki,
  SettingsStore,
  type ExtensionLogger
} from '@kisaki3/extension-sdk'
import { MalMirrorClient } from './api/mirror-client'
import { MalOfficialClient } from './api/official-client'
import { MalOauthFlow } from './auth/oauth-flow'
import { TokenManager } from './auth/token-manager'
import { TokenStore } from './auth/token-store'
import { createDefaultMalSettings } from './config/defaults'
import { normalizeMalSettings } from './config/schema'
import { m, setHostUiLocale } from './i18n'
import { MalAnimeProvider, MalComicProvider, MalNovelProvider } from './media/media-providers'
import type { MalRuntime } from './media/runtime'
import { registerMalSettingsUi } from './settings'
import { SyncEngine } from './sync/engine'
import { SyncStateStore } from './sync/state'
import { SyncSubscription } from './sync/subscription'
import { SyncSuppressor } from './sync/suppressor'
import { MalTasks } from './tasks'
import { MalExtensionError, toSafeErrorLog } from './utils/errors'
import { MAL_STORAGE_KEYS } from './utils/ids'

export default defineExtension({
  async activate(context) {
    setHostUiLocale((await kisaki.runtime.getInfo()).uiLocale)
    context.hooks.on('app.ui-locale.changed', ({ effective }) => {
      setHostUiLocale(effective)
    })

    const settingsStore = new SettingsStore(context.storage, MAL_STORAGE_KEYS.settings, {
      normalize: normalizeMalSettings,
      createDefault: createDefaultMalSettings
    })
    const tokenStore = new TokenStore(context.secrets)
    await settingsStore.get()

    const tokenManager = new TokenManager(kisaki.network, tokenStore, context.logger)
    const official = new MalOfficialClient(
      kisaki.network,
      tokenManager,
      () => settingsStore.get(),
      context.logger
    )
    const mirror = new MalMirrorClient(kisaki.network, () => settingsStore.get(), context.logger)
    const runtime: MalRuntime = {
      official,
      mirror,
      logger: context.logger,
      getSettings: () => settingsStore.get()
    }

    const oauthFlowRef: { current?: MalOauthFlow } = {}

    const deeplinkRegistration = context.contributions.deeplinkRoutes.register({
      id: 'oauth-callback',
      path: '/oauth-callback',
      async handle(event) {
        try {
          const oauthFlow = oauthFlowRef.current
          if (!oauthFlow) {
            throw new MalExtensionError('auth_cancelled', m().errors.loginNotReady)
          }

          await oauthFlow.completeFromDeeplink(event, context.abortSignal)
          const user = await official.getOwnUser({ signal: context.abortSignal })
          const userName = user.name?.trim() || String(user.id)
          await notifyLoginSuccess(userName, context.logger)
          return {
            success: true,
            status: 'handled',
            message: m().oauth.loginCompleted({ userName })
          }
        } catch (error) {
          const message = toUserMessage(error)
          context.logger.warn('MAL OAuth callback failed.', toSafeErrorLog(error))
          await notifyLoginFailure(message, context.logger)
          return { success: false, status: 'error', message }
        }
      }
    })

    const oauthFlow = new MalOauthFlow({
      tokens: tokenManager,
      store: tokenStore,
      callbackUrl: deeplinkRegistration.urlPattern,
      openExternal: (url) => kisaki.runtime.openExternal(url),
      logger: context.logger
    })
    oauthFlowRef.current = oauthFlow

    const syncStateStore = new SyncStateStore(context.storage)
    const syncSuppressor = new SyncSuppressor()
    const syncEngine = new SyncEngine({
      settingsStore,
      client: official,
      stateStore: syncStateStore,
      suppressor: syncSuppressor
    })
    const tasks = new MalTasks({
      client: official,
      engine: syncEngine,
      suppressor: syncSuppressor,
      logger: context.logger
    })

    context.logger.info('Built-in MyAnimeList integration activated.')

    context.subscriptions.add(deeplinkRegistration)
    context.subscriptions.add(
      context.contributions.scraperProviders.anime.register(new MalAnimeProvider(runtime))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.comic.register(new MalComicProvider(runtime))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.novel.register(new MalNovelProvider(runtime))
    )
    context.subscriptions.add(
      new SyncSubscription({
        hooks: context.hooks,
        settingsStore,
        engine: syncEngine,
        logger: context.logger
      }).start()
    )

    registerMalSettingsUi(context, {
      settingsStore,
      tokenStore,
      client: official,
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
    logger.warn('MAL OAuth success notification failed.', toSafeErrorLog(error))
  }
}

async function notifyLoginFailure(message: string, logger: ExtensionLogger): Promise<void> {
  try {
    await kisaki.notify.error(m().oauth.loginFailedTitle, { message })
  } catch (error) {
    logger.warn('MAL OAuth failure notification failed.', toSafeErrorLog(error))
  }
}

function toUserMessage(error: unknown): string {
  if (error instanceof MalExtensionError) {
    return error.message
  }

  return m().oauth.callbackFailed
}
