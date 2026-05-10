/**
 * Launch Handler
 *
 * Handles kisaki://launch/* deeplinks for launching media.
 *
 * Supported URLs:
 * - kisaki://launch/{mediaType}/{entityId}
 */

import log from 'electron-log/main'
import type { DeeplinkResult, DeeplinkRouteContext, DeeplinkRouteHandler } from '../types'
import type { LauncherService } from '@main/services/launcher'

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

      log.info(`[LaunchHandler] Launched game via deeplink: ${gameId}`)

      return {
        success: true,
        path: deeplink.path,
        pattern: deeplink.pattern,
        message: `Launched: ${gameId}`,
        data: { mediaType: 'game', entityId: gameId }
      }
    } catch (error) {
      log.error(`[LaunchHandler] Failed to launch game ${gameId}:`, error)
      return {
        success: false,
        path: deeplink.path,
        pattern: deeplink.pattern,
        message: (error as Error).message
      }
    }
  }
}
