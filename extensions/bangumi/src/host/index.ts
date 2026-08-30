import { defineExtension, kisaki, type ExtensionLogger } from '@kisaki3/extension-sdk'
import { OAuthRelayClient, OAuthRelayFlow } from './auth/oauth-relay'
import { SettingsStore } from './utils/settings-store'
import { m } from './i18n'
import { BangumiClient } from './api/client'
import { createBangumiUserAgent } from './api/user-agent'
import { AccountService } from './auth/account'
import { TokenService } from './auth/token-service'
import { TokenStore } from './auth/token-store'
import { createDefaultBangumiSettings } from './config/defaults'
import { normalizeBangumiSettings } from './config/schema'
import { registerBangumiJobCommands } from './jobs/commands'
import { BangumiJobEvents } from './jobs/events'
import { JobRunner } from './jobs/runner'
import { AnimeLocalMediaAdapter, createAnimeMediaDescriptor } from './media/anime/adapter'
import { BangumiAnimeProvider } from './media/anime/scraper/provider'
import { BookLocalMediaAdapter, createBookMediaDescriptor } from './media/book/adapter'
import { BangumiCharacterProvider } from './media/character/provider'
import { BangumiComicProvider } from './media/comic/scraper/provider'
import { BangumiNovelProvider } from './media/novel/scraper/provider'
import { BangumiCompanyProvider } from './media/company/provider'
import { GameLocalMediaAdapter, createGameMediaDescriptor } from './media/game/adapter'
import { BangumiGameProvider } from './media/game/scraper/provider'
import { createMusicMediaDescriptor } from './media/music/scope'
import { BangumiPersonProvider } from './media/person/provider'
import { MediaRegistry } from './media/registry'
import { registerBangumiSettingsUi, type BangumiSettingsUiHandle } from './settings'
import { BANGUMI_OAUTH_RELAY_BASE_URL } from './utils/constants'
import { BangumiExtensionError, createRelayError } from './utils/errors'
import { BANGUMI_STORAGE_KEYS } from './utils/ids'
import { SyncEngine } from './sync/engine'
import { EpisodeSyncStateStore } from './sync/episode-state'
import { EpisodeSyncEngine } from './sync/episodes'
import { SyncStateStore } from './sync/fingerprint'
import { SyncQueueStore } from './sync/queue'
import { SyncSubscription } from './sync/subscription'
export default defineExtension({
  async activate(context) {
    const settingsStore = new SettingsStore(context.storage, BANGUMI_STORAGE_KEYS.settings, {
      normalize: normalizeBangumiSettings,
      createDefault: createDefaultBangumiSettings
    })
    const tokenStore = new TokenStore(context.secrets)
    await settingsStore.get()

    const relayClient = new OAuthRelayClient({
      network: kisaki.network,
      getBaseUrl: async () => BANGUMI_OAUTH_RELAY_BASE_URL,
      getTimeoutMs: async () => (await settingsStore.get()).client.timeoutMs,
      createError: createRelayError
    })
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
    const selfActor = `extension:${context.extension.id}`
    const gameAdapter = new GameLocalMediaAdapter(context.hooks, selfActor)
    const animeAdapter = new AnimeLocalMediaAdapter(context.hooks, selfActor)
    const bookAdapter = new BookLocalMediaAdapter({
      hooks: context.hooks,
      selfActor,
      resolveSubjectPlatform: async (subjectId) => {
        const subject = await client.getSubject(Number.parseInt(subjectId, 10))
        return subject.platform ?? undefined
      }
    })
    const mediaRegistry = new MediaRegistry([
      createBookMediaDescriptor(bookAdapter),
      createGameMediaDescriptor(gameAdapter),
      createAnimeMediaDescriptor(animeAdapter),
      createMusicMediaDescriptor()
    ])
    const syncStateStore = new SyncStateStore(context.storage)
    const syncQueueStore = new SyncQueueStore(context.storage)
    const syncEngine = new SyncEngine({
      settingsStore,
      client,
      mediaRegistry,
      stateStore: syncStateStore,
      logger: context.logger
    })
    const episodeSyncStateStore = new EpisodeSyncStateStore(context.storage)
    const episodeSyncEngine = new EpisodeSyncEngine({
      settingsStore,
      client,
      mediaRegistry,
      stateStore: episodeSyncStateStore,
      logger: context.logger
    })
    const jobRunner = new JobRunner({
      settingsStore,
      client,
      tokenService,
      accountService,
      syncEngine,
      episodeSyncEngine,
      mediaRegistry,
      syncQueueStore,
      logger: context.logger
    })
    const jobEvents = new BangumiJobEvents()

    const oauthFlowRef: { current?: OAuthRelayFlow } = {}
    const settingsUiRef: { current?: BangumiSettingsUiHandle } = {}

    const deeplinkRegistration = context.contributions.deeplinkRoutes.register({
      id: 'oauth-callback',
      path: '/oauth-callback',
      async handle(event) {
        try {
          const oauthFlow = oauthFlowRef.current
          if (!oauthFlow) {
            throw new BangumiExtensionError('relay_unavailable', m().errors.loginNotReady)
          }

          await oauthFlow.completeFromDeeplink(event)
          const account = await accountService.refreshAccount()
          settingsUiRef.current?.notifyOauthCompleted()
          await notifyLoginSuccess(account.nickname, context.logger)
          return {
            success: true,
            status: 'handled',
            message: m().oauth.loginCompleted({ nickname: account.nickname })
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

    const oauthFlow = new OAuthRelayFlow({
      client: relayClient,
      store: tokenStore,
      callbackUrl: deeplinkRegistration.urlPattern,
      openExternal: (url) => kisaki.runtime.openExternal(url),
      getLoginTimeoutMs: async () => (await settingsStore.get()).auth.loginTimeoutMs,
      createError: createRelayError,
      logger: context.logger
    })
    oauthFlowRef.current = oauthFlow

    context.logger.info('Built-in Bangumi integration activated.')

    context.subscriptions.add(deeplinkRegistration)
    context.subscriptions.add(
      context.contributions.scraperProviders.game.register(new BangumiGameProvider(client))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.anime.register(new BangumiAnimeProvider(client))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.comic.register(new BangumiComicProvider(client))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.novel.register(new BangumiNovelProvider(client))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.person.register(new BangumiPersonProvider(client))
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.character.register(
        new BangumiCharacterProvider(client)
      )
    )
    context.subscriptions.add(
      context.contributions.scraperProviders.company.register(new BangumiCompanyProvider(client))
    )
    for (const registration of registerBangumiJobCommands({
      commands: context.contributions.commands,
      runner: jobRunner,
      events: jobEvents,
      signal: context.abortSignal,
      logger: context.logger
    })) {
      context.subscriptions.add(registration)
    }
    context.subscriptions.add(
      await new SyncSubscription({
        settingsStore,
        engine: syncEngine,
        episodeEngine: episodeSyncEngine,
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
      jobEvents,
      mediaRegistry,
      syncStateStore,
      episodeSyncStateStore,
      syncQueueStore,
      logger: context.logger,
      abortSignal: context.abortSignal
    })
  }
})

async function notifyLoginSuccess(nickname: string, logger: ExtensionLogger): Promise<void> {
  try {
    await kisaki.notify.success(m().oauth.loginSucceededTitle, {
      message: nickname
    })
  } catch (error) {
    logger.warn('Bangumi OAuth success notification failed.', toSafeErrorLog(error))
  }
}

async function notifyLoginFailure(message: string, logger: ExtensionLogger): Promise<void> {
  try {
    await kisaki.notify.error(m().oauth.loginFailedTitle, {
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

  return m().oauth.callbackFailed
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
