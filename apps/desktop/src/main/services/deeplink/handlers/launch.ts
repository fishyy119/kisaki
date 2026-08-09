/**
 * Launch Handler
 *
 * Handles kisaki://launch/* deeplinks for launching media.
 *
 * Supported URLs:
 * - kisaki://launch/{mediaType}/{entityId}
 */

import { createLogger } from '@main/log'
import type { DeeplinkResult, DeeplinkRouteContext, DeeplinkRouteHandler } from '../types'
import type { LauncherService } from '@main/services/launcher'
import type { NotifyService } from '@main/services/notify'
import type { I18nService } from '@main/services/i18n'
import type { GameLaunchResult } from '@shared/launcher'

const log = createLogger('Deeplink')

export const LAUNCH_DEEPLINK_ROUTE = '/launch/:mediaType/:entityId' as const

type LaunchDeeplinkContext = DeeplinkRouteContext<typeof LAUNCH_DEEPLINK_ROUTE>

export class LaunchHandler implements DeeplinkRouteHandler<typeof LAUNCH_DEEPLINK_ROUTE> {
  constructor(
    private readonly launcher: LauncherService,
    private readonly notify: NotifyService,
    private readonly i18n: I18nService
  ) {}

  async handle(deeplink: LaunchDeeplinkContext): Promise<DeeplinkResult> {
    const { mediaType, entityId } = deeplink.params

    switch (mediaType) {
      case 'game':
        return this.launchGame(entityId, deeplink)
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
    const result = await this.launcher.game.launchGame(gameId)
    this.notifyLaunchOutcome(result)

    if (result.status !== 'detected') {
      log.warn('Game launch was not confirmed via deeplink.', {
        gameId: gameId,
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

    log.info('Game launch confirmed via deeplink.', { gameId: gameId, processPid: result.pid })

    return {
      success: true,
      path: deeplink.path,
      pattern: deeplink.pattern,
      message: `Launch confirmed: ${gameId}`,
      data: { mediaType: 'game', entityId: gameId, launch: result }
    }
  }

  /** A deeplink launch has no button state, so anything unexpected is toasted. */
  private notifyLaunchOutcome(result: GameLaunchResult): void {
    const messages = this.i18n.messages.launcher

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
