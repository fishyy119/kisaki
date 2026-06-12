import { defineExtension, kisaki, type ExtensionLogger } from '@kisaki3/extension-sdk'
import { BangumiClient } from './api/client'
import { createBangumiUserAgent } from './api/user-agent'
import { AccountService } from './auth/account'
import { OAuthFlow } from './auth/oauth-flow'
import { OAuthRelayClient } from './auth/relay-client'
import { TokenService } from './auth/token-service'
import { TokenStore } from './auth/token-store'
import { SettingsStore } from './config/store'
import { registerBangumiJobCommands } from './jobs/commands'
import { JobRunner } from './jobs/runner'
import { createAnimeMediaDescriptor } from './media/anime/scope'
import { createBookMediaDescriptor } from './media/book/scope'
import { GameLocalMediaAdapter, createGameMediaDescriptor } from './media/game/adapter'
import { BangumiProvider } from './media/game/scraper/provider'
import { createMusicMediaDescriptor } from './media/music/scope'
import { MediaRegistry } from './media/registry'
import { registerBangumiSettingsUi, type BangumiSettingsUiHandle } from './settings'
import { BangumiExtensionError } from './utils/errors'
import { SyncEngine } from './sync/engine'
import { SyncStateStore } from './sync/fingerprint'
import { SyncQueueStore } from './sync/queue'
import { SyncSubscription } from './sync/subscription'
import { SyncSuppressor } from './sync/suppressor'

export default defineExtension({
  async activate(context) {
    const settingsStore = new SettingsStore(context.storage)
    const tokenStore = new TokenStore(context.secrets)
    await settingsStore.get()

    const relayClient = new OAuthRelayClient(
      kisaki.network,
      async () => (await settingsStore.get()).client.timeoutMs
    )
    const tokenService = new TokenService(tokenStore, relayClient, context.logger)
    const client = new BangumiClient(
      kisaki.network,
      tokenService,
      async () => (await settingsStore.get()).client,
      {
        userAgent: createBangumiUserAgent(context.extension.version),
        logger: context.logger
      }
    )
    const accountService = new AccountService(context.storage, client, tokenService)
    const gameAdapter = new GameLocalMediaAdapter()
    const mediaRegistry = new MediaRegistry([
      createBookMediaDescriptor(),
      createGameMediaDescriptor(gameAdapter),
      createAnimeMediaDescriptor(),
      createMusicMediaDescriptor()
    ])
    const syncStateStore = new SyncStateStore(context.storage)
    const syncQueueStore = new SyncQueueStore(context.storage)
    const syncSuppressor = new SyncSuppressor()
    const syncEngine = new SyncEngine({
      settingsStore,
      client,
      mediaRegistry,
      stateStore: syncStateStore,
      suppressor: syncSuppressor,
      logger: context.logger
    })
    const jobRunner = new JobRunner({
      settingsStore,
      client,
      tokenService,
      accountService,
      syncEngine,
      mediaRegistry,
      syncQueueStore,
      syncSuppressor,
      logger: context.logger
    })

    const oauthFlowRef: { current?: OAuthFlow } = {}
    const settingsUiRef: { current?: BangumiSettingsUiHandle } = {}

    const deeplinkRegistration = context.contributions.deeplinkRoutes.register({
      id: 'oauth-callback',
      path: '/oauth-callback',
      async handle(event) {
        try {
          const oauthFlow = oauthFlowRef.current
          if (!oauthFlow) {
            throw new BangumiExtensionError('relay_unavailable', 'Bangumi 登录尚未准备好。')
          }

          await oauthFlow.completeFromDeeplink(event)
          const account = await accountService.refreshAccount()
          settingsUiRef.current?.notifyOauthCompleted()
          await notifyLoginSuccess(account.nickname, context.logger)
          return {
            success: true,
            status: 'handled',
            message: `Bangumi 登录完成：${account.nickname}`
          }
        } catch (error) {
          const message = toUserMessage(error)
          context.logger.warn('Bangumi OAuth callback failed.', toSafeErrorLog(error))
          await notifyLoginFailure(message, context.logger)
          return {
            success: false,
            status: 'error',
            message
          }
        }
      }
    })

    const oauthFlow = new OAuthFlow({
      callbackUrl: deeplinkRegistration.urlPattern,
      relayClient,
      tokenStore,
      openExternal: (url) => kisaki.runtime.openExternal(url),
      getLoginTimeoutMs: async () => (await settingsStore.get()).auth.loginTimeoutMs,
      logger: context.logger
    })
    oauthFlowRef.current = oauthFlow

    context.logger.info('Built-in Bangumi integration activated.')

    context.subscriptions.add(deeplinkRegistration)
    context.subscriptions.add(
      context.contributions.scraperProviders.game.register(new BangumiProvider(client))
    )
    for (const registration of registerBangumiJobCommands(
      context.contributions.commands,
      jobRunner,
      context.abortSignal
    )) {
      context.subscriptions.add(registration)
    }
    context.subscriptions.add(
      await new SyncSubscription({
        settingsStore,
        engine: syncEngine,
        mediaRegistry,
        queueStore: syncQueueStore,
        logger: context.logger
      }).start()
    )
    settingsUiRef.current = registerBangumiSettingsUi(context, {
      settingsStore,
      accountService,
      oauthFlow,
      tokenService,
      jobRunner,
      mediaRegistry,
      syncStateStore,
      syncQueueStore,
      abortSignal: context.abortSignal
    })
  }
})

async function notifyLoginSuccess(nickname: string, logger: ExtensionLogger): Promise<void> {
  try {
    await kisaki.notify.success('Bangumi 登录完成', {
      message: nickname
    })
  } catch (error) {
    logger.warn('Bangumi OAuth success notification failed.', toSafeErrorLog(error))
  }
}

async function notifyLoginFailure(message: string, logger: ExtensionLogger): Promise<void> {
  try {
    await kisaki.notify.error('Bangumi 登录失败', {
      message
    })
  } catch (error) {
    logger.warn('Bangumi OAuth failure notification failed.', toSafeErrorLog(error))
  }
}

function toUserMessage(error: unknown): string {
  if (error instanceof BangumiExtensionError) {
    return error.message
  }

  return 'Bangumi 登录回调处理失败，请回到设置页重试。'
}

function toSafeErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof BangumiExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}
