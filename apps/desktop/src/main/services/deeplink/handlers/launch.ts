/**
 * Launch Handler
 *
 * Handles kisaki://launch/* deeplinks for starting consumption of an entry,
 * whichever engine that entry uses.
 *
 * Supported URLs:
 * - kisaki://launch/{mediaType}/{entityId}
 * - kisaki://launch/anime/{animeId}?episode={episodeId}
 * - kisaki://launch/comic/{comicId}?chapter={chapterId}
 * - kisaki://launch/novel/{novelId}?volume={volumeId}
 */

import { createLogger } from '@main/log'
import type { DeeplinkResult, DeeplinkRouteContext, DeeplinkRouteHandler } from '../types'
import type { ActivityService } from '@main/services/activity'
import type { NotifyService } from '@main/services/notify'
import type { I18nService } from '@main/services/i18n'
import type {
  AnimeWatchResult,
  ComicReadResult,
  GameLaunchResult,
  NovelReadResult
} from '@shared/activity'

const log = createLogger('Deeplink')

export const LAUNCH_DEEPLINK_ROUTE = '/launch/:mediaType/:entityId' as const

type LaunchDeeplinkContext = DeeplinkRouteContext<typeof LAUNCH_DEEPLINK_ROUTE>

export class LaunchHandler implements DeeplinkRouteHandler<typeof LAUNCH_DEEPLINK_ROUTE> {
  constructor(
    private readonly activity: ActivityService,
    private readonly notify: NotifyService,
    private readonly i18n: I18nService
  ) {}

  async handle(deeplink: LaunchDeeplinkContext): Promise<DeeplinkResult> {
    const { mediaType, entityId } = deeplink.params

    switch (mediaType) {
      case 'game':
        return this.launchGame(entityId, deeplink)
      case 'anime':
        return this.watchAnime(entityId, deeplink)
      case 'comic':
        return this.readComic(entityId, deeplink)
      case 'novel':
        return this.readNovel(entityId, deeplink)
      default:
        return {
          success: false,
          path: deeplink.path,
          pattern: deeplink.pattern,
          message: `Launch is not supported for media type: ${mediaType}`
        }
    }
  }

  private async launchGame(
    gameId: string,
    deeplink: LaunchDeeplinkContext
  ): Promise<DeeplinkResult> {
    const result = await this.activity.game.launch(gameId)
    this.notifyLaunchOutcome(result)

    if (result.status !== 'detected') {
      log.warn('Game launch was not confirmed via deeplink.', {
        gameId,
        resultStatus: result.status
      })
      return {
        success: false,
        path: deeplink.path,
        pattern: deeplink.pattern,
        message: getLaunchDeeplinkMessage(gameId, result),
        data: { mediaType: 'game', entityId: gameId, launch: result }
      }
    }

    log.info('Game launch confirmed via deeplink.', { gameId, processPid: result.pid })

    return {
      success: true,
      path: deeplink.path,
      pattern: deeplink.pattern,
      message: `Launch confirmed: ${gameId}`,
      data: { mediaType: 'game', entityId: gameId, launch: result }
    }
  }

  private async watchAnime(
    animeId: string,
    deeplink: LaunchDeeplinkContext
  ): Promise<DeeplinkResult> {
    const episodeId = deeplink.query.episode
    const result = await this.activity.anime.watch(animeId, episodeId)

    if (result.status === 'failed') {
      this.notify.error(
        this.i18n.messages.activity.watchFailedTitle,
        this.i18n.messages.activity.errors[result.reason]
      )
      log.warn('Anime watch failed via deeplink.', { animeId, reason: result.reason })
      return {
        success: false,
        path: deeplink.path,
        pattern: deeplink.pattern,
        message: getWatchDeeplinkMessage(animeId, result),
        data: { mediaType: 'anime', entityId: animeId, watch: result }
      }
    }

    log.info('Anime watch started via deeplink.', { animeId, episodeId: result.episodeId })

    return {
      success: true,
      path: deeplink.path,
      pattern: deeplink.pattern,
      message: getWatchDeeplinkMessage(animeId, result),
      data: { mediaType: 'anime', entityId: animeId, watch: result }
    }
  }

  private async readComic(
    comicId: string,
    deeplink: LaunchDeeplinkContext
  ): Promise<DeeplinkResult> {
    const result = this.activity.comic.read(comicId, deeplink.query.chapter)

    if (result.status === 'failed') {
      this.notify.error(
        this.i18n.messages.activity.readFailedTitle,
        this.i18n.messages.activity.errors[result.reason]
      )
      log.warn('Comic read failed via deeplink.', { comicId, reason: result.reason })
      return {
        success: false,
        path: deeplink.path,
        pattern: deeplink.pattern,
        message: `Read failed: ${comicId} (${result.reason})`,
        data: { mediaType: 'comic', entityId: comicId, read: result }
      }
    }

    log.info('Comic reader opened via deeplink.', { comicId, chapterId: result.chapterId })

    return {
      success: true,
      path: deeplink.path,
      pattern: deeplink.pattern,
      message: getComicReadDeeplinkMessage(comicId, result),
      data: { mediaType: 'comic', entityId: comicId, read: result }
    }
  }

  private async readNovel(
    novelId: string,
    deeplink: LaunchDeeplinkContext
  ): Promise<DeeplinkResult> {
    const result = this.activity.novel.read(novelId, deeplink.query.volume)

    if (result.status === 'failed') {
      this.notify.error(
        this.i18n.messages.activity.readFailedTitle,
        this.i18n.messages.activity.errors[result.reason]
      )
      log.warn('Novel read failed via deeplink.', { novelId, reason: result.reason })
      return {
        success: false,
        path: deeplink.path,
        pattern: deeplink.pattern,
        message: `Read failed: ${novelId} (${result.reason})`,
        data: { mediaType: 'novel', entityId: novelId, read: result }
      }
    }

    log.info('Novel reader opened via deeplink.', { novelId, volumeId: result.volumeId })

    return {
      success: true,
      path: deeplink.path,
      pattern: deeplink.pattern,
      message: getNovelReadDeeplinkMessage(novelId, result),
      data: { mediaType: 'novel', entityId: novelId, read: result }
    }
  }

  /** A deeplink launch has no button state, so anything unexpected is toasted. */
  private notifyLaunchOutcome(result: GameLaunchResult): void {
    const messages = this.i18n.messages.activity

    switch (result.status) {
      case 'detected':
        return
      case 'cancelled':
        this.notify.warning(messages.launchCancelledTitle)
        return
      case 'unconfirmed':
        this.notify.warning(messages.launchRequestedTitle, messages[result.reason])
        return
      case 'failed':
        this.notify.error(messages.launchFailedTitle, messages.errors[result.reason])
    }
  }
}

function getWatchDeeplinkMessage(animeId: string, result: AnimeWatchResult): string {
  return result.status === 'started'
    ? `Watch started: ${animeId} (${result.episodeId})`
    : `Watch failed: ${animeId} (${result.reason})`
}

function getComicReadDeeplinkMessage(comicId: string, result: ComicReadResult): string {
  switch (result.status) {
    case 'started':
      return `Reading started: ${comicId} (${result.chapterId})`
    case 'refocused':
      return `Reader refocused: ${comicId} (${result.chapterId})`
    case 'failed':
      return `Read failed: ${comicId} (${result.reason})`
  }
}

function getNovelReadDeeplinkMessage(novelId: string, result: NovelReadResult): string {
  switch (result.status) {
    case 'started':
      return `Reading started: ${novelId} (${result.volumeId})`
    case 'refocused':
      return `Reader refocused: ${novelId} (${result.volumeId})`
    case 'failed':
      return `Read failed: ${novelId} (${result.reason})`
  }
}

function getLaunchDeeplinkMessage(gameId: string, result: GameLaunchResult): string {
  switch (result.status) {
    case 'detected':
      return `Launch confirmed: ${gameId}`
    case 'cancelled':
      return `Launch cancelled: ${gameId}`
    case 'unconfirmed':
      return `Launch requested but not confirmed: ${gameId}`
    case 'failed':
      return `Launch failed: ${gameId} (${result.reason})`
  }
}
