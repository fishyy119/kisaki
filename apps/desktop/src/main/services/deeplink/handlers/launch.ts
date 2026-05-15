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

const log = createLogger('Deeplink')

export const LAUNCH_DEEPLINK_ROUTE = '/launch/:mediaType/:entityId' as const

type LaunchDeeplinkContext = DeeplinkRouteContext<typeof LAUNCH_DEEPLINK_ROUTE>

export class LaunchHandler implements DeeplinkRouteHandler<typeof LAUNCH_DEEPLINK_ROUTE> {
  constructor(private readonly launcher: LauncherService) {}

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
    try {
      // Launch the game
      await this.launcher.game.launchGame(gameId, { cancelBehavior: 'throw' })

      log.info('Launched game via deeplink.', { gameId: gameId })

      return {
        success: true,
        path: deeplink.path,
        pattern: deeplink.pattern,
        message: `Launched: ${gameId}`,
        data: { mediaType: 'game', entityId: gameId }
      }
    } catch (error) {
      log.error('Failed to launch game.', error, { gameId: gameId })
      return {
        success: false,
        path: deeplink.path,
        pattern: deeplink.pattern,
        message: (error as Error).message
      }
    }
  }
}
