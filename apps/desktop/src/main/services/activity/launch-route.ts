/**
 * `kisaki://launch/*` route: starts consumption of an entry, whichever engine
 * that entry uses.
 *
 * The route lives with the service that owns the action. Activity registers
 * it on the deeplink router at init, so the platform-level router never needs
 * to know what a launch means. As the entry adapter of the launch flow it
 * owns the user notifications for unexpected outcomes; `open` and `launch`
 * stay orthogonal, so launching never navigates or focuses the main window.
 *
 * Supported URLs:
 * - kisaki://launch/game/{gameId}
 * - kisaki://launch/anime/{animeId}?episode={episodeId}
 * - kisaki://launch/comic/{comicId}?chapter={chapterId}
 * - kisaki://launch/novel/{novelId}?volume={volumeId}
 */

import { createLogger } from '@main/log'
import type { DeeplinkOutcome, DeeplinkRouteHandler } from '@main/services/deeplink'
import type { NotificationService } from '@main/services/notification'
import type { I18nService } from '@main/services/i18n'
import type { AnimeWatchResult, GameLaunchResult, ReadingResult } from '@shared/activity'
import type { ActivityService } from './service'

const log = createLogger('Activity')

export const LAUNCH_DEEPLINK_ROUTE = '/launch/:mediaType/:entityId' as const

export function createLaunchRoute(
  activity: ActivityService,
  notification: NotificationService,
  i18n: I18nService
): DeeplinkRouteHandler<typeof LAUNCH_DEEPLINK_ROUTE> {
  /** A deeplink launch has no button state, so anything unexpected is toasted. */
  function notifyLaunchOutcome(result: GameLaunchResult): void {
    const messages = i18n.messages.activity

    switch (result.status) {
      case 'detected':
        return
      case 'cancelled':
        notification.warning(messages.launchCancelledTitle)
        return
      case 'unconfirmed':
        notification.warning(messages.launchRequestedTitle, messages[result.reason])
        return
      case 'failed':
        notification.error(messages.launchFailedTitle, messages.errors[result.reason])
    }
  }

  async function launchGame(gameId: string): Promise<DeeplinkOutcome> {
    const result = await activity.game.launch(gameId)
    notifyLaunchOutcome(result)

    if (result.status !== 'detected') {
      log.warn('Game launch was not confirmed via deeplink.', {
        gameId,
        resultStatus: result.status
      })
      return { status: 'failed', message: getLaunchDeeplinkMessage(gameId, result) }
    }

    log.info('Game launch confirmed via deeplink.', { gameId, processPid: result.pid })
    return { status: 'handled' }
  }

  async function watchAnime(animeId: string, episodeId?: string): Promise<DeeplinkOutcome> {
    const result = await activity.anime.watch(animeId, episodeId)

    if (result.status === 'failed') {
      notification.error(
        i18n.messages.activity.watchFailedTitle,
        i18n.messages.activity.errors[result.reason]
      )
      log.warn('Anime watch failed via deeplink.', { animeId, reason: result.reason })
      return { status: 'failed', message: getWatchDeeplinkMessage(animeId, result) }
    }

    log.info('Anime watch started via deeplink.', { animeId, episodeId: result.episodeId })
    return { status: 'handled' }
  }

  function readEntry(
    media: 'comic' | 'novel',
    entryId: string,
    unitId: string | undefined
  ): DeeplinkOutcome {
    const result = activity[media].read(entryId, unitId)

    if (result.status === 'failed') {
      notification.error(
        i18n.messages.activity.readFailedTitle,
        i18n.messages.activity.errors[result.reason]
      )
      log.warn('Read failed via deeplink.', { media, entryId, reason: result.reason })
      return { status: 'failed', message: getReadDeeplinkMessage(entryId, result) }
    }

    log.info('Reader opened via deeplink.', { media, entryId, unitId: result.unitId })
    return { status: 'handled' }
  }

  return async (context) => {
    const { mediaType, entityId } = context.params

    switch (mediaType) {
      case 'game':
        return launchGame(entityId)
      case 'anime':
        return watchAnime(entityId, context.query.episode)
      case 'comic':
        return readEntry('comic', entityId, context.query.chapter)
      case 'novel':
        return readEntry('novel', entityId, context.query.volume)
      default:
        return {
          status: 'failed',
          message: `Launch is not supported for media type: ${mediaType}`
        }
    }
  }
}

function getWatchDeeplinkMessage(animeId: string, result: AnimeWatchResult): string {
  return result.status === 'started'
    ? `Watch started: ${animeId} (${result.episodeId})`
    : `Watch failed: ${animeId} (${result.reason})`
}

function getReadDeeplinkMessage(entryId: string, result: ReadingResult): string {
  switch (result.status) {
    case 'started':
      return `Reading started: ${entryId} (${result.unitId})`
    case 'refocused':
      return `Reader refocused: ${entryId} (${result.unitId})`
    case 'failed':
      return `Read failed: ${entryId} (${result.reason})`
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
