import { defineExtension, kisaki, type ExtensionLogger } from '@kisaki3/extension-sdk'
import { SettingsStore } from './utils/settings-store'
import { MalMirrorClient } from './api/mirror-client'
import { MalOfficialClient } from './api/official-client'
import { MalOauthFlow } from './auth/oauth-flow'
import { TokenManager } from './auth/token-manager'
import { TokenStore } from './auth/token-store'
import { createDefaultMalSettings } from './config/defaults'
import { normalizeMalSettings } from './config/schema'
import { m } from './i18n'
import { registerMalJobCommands } from './jobs/commands'
import { MalAnimeProvider, MalComicProvider, MalNovelProvider } from './media/media-providers'
import type { MalRuntime } from './media/runtime'
import { registerMalSettingsUi, type MalSettingsUiHandle } from './settings'
import { SyncEngine } from './sync/engine'
import { SyncStateStore } from './sync/state'
import { SyncSubscription } from './sync/subscription'
import { MalTasks } from './tasks'
import { MalExtensionError, toSafeErrorLog } from './utils/errors'
import { MAL_STORAGE_KEYS } from './utils/ids'

export default defineExtension({
  async activate(context) {
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
    const settingsUiRef: { current?: MalSettingsUiHandle } = {}

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
          settingsUiRef.current?.notifyOauthSettled('completed')
          await notifyLoginSuccess(userName, context.logger)
          return {
            success: true,
            status: 'handled',
            message: m().oauth.loginCompleted({ userName })
          }
        } catch (error) {
          const message = toUserMessage(error)
          context.logger.warn('MAL OAuth callback failed.', toSafeErrorLog(error))
          // A failed attempt can still consume the pending login, so the
          // open dialog must re-read account state as well.
          settingsUiRef.current?.notifyOauthSettled('failed')
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
    const syncEngine = new SyncEngine({
      settingsStore,
      client: official,
      stateStore: syncStateStore
    })
    const tasks = new MalTasks({
      client: official,
      engine: syncEngine,
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
        selfActor: `extension:${context.extension.id}`,
        settingsStore,
        engine: syncEngine,
        logger: context.logger
      }).start()
    )
    for (const registration of registerMalJobCommands({
      commands: context.contributions.commands,
      tasks,
      client: official,
      tokenStore,
      signal: context.abortSignal,
      logger: context.logger
    })) {
      context.subscriptions.add(registration)
    }

    settingsUiRef.current = registerMalSettingsUi(context, {
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
