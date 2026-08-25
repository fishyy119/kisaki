/**
 * Navigate Handler
 *
 * Handles kisaki://navigate/* deeplinks for in-app navigation.
 *
 * Supported URLs:
 * - kisaki://navigate/library
 * - kisaki://navigate/library/{entityType}/{entityId}
 * - kisaki://navigate/scanner
 * - kisaki://navigate/extension
 */

import { createLogger } from '@main/log'
import type { DeeplinkResult, DeeplinkRouteContext, DeeplinkRouteHandler } from '../types'
import type { IpcService } from '@main/services/ipc'
import type { WindowService } from '@main/services/window'

const log = createLogger('Deeplink')

export const NAVIGATE_DEEPLINK_ROUTE = '/navigate/*routePath' as const

type NavigateDeeplinkContext = DeeplinkRouteContext<typeof NAVIGATE_DEEPLINK_ROUTE>

export class NavigateHandler implements DeeplinkRouteHandler<typeof NAVIGATE_DEEPLINK_ROUTE> {
  constructor(
    private readonly ipc: IpcService,
    private readonly windowService: WindowService
  ) {}

  async handle(deeplink: NavigateDeeplinkContext): Promise<DeeplinkResult> {
    const routePath = deeplink.params.routePath
    const route = routePath ? `/${routePath}` : '/'

    try {
      // Send navigation event to renderer
      this.ipc.send('deeplink:navigate', {
        route,
        query: deeplink.query
      })

      // Focus window
      this.focusMainWindow()

      log.info('Navigate to.', { route: route })

      return {
        success: true,
        path: deeplink.path,
        pattern: deeplink.pattern,
        message: `Navigating to: ${route}`,
        data: { route, query: deeplink.query }
      }
    } catch (error) {
      log.error('Navigation failed:', error)
      return {
        success: false,
        path: deeplink.path,
        pattern: deeplink.pattern,
        message: (error as Error).message
      }
    }
  }

  private focusMainWindow(): void {
    try {
      this.windowService.mainWindow.focus()
    } catch (error) {
      log.error('Error focusing main window:', error)
    }
  }
}
