/**
 * `kisaki://open/<destination>` route: shows a named destination in the main
 * window. The platform only transports the destination subtree; the renderer
 * owns the destination vocabulary and its resolution (`core/deeplink.ts`),
 * including the feedback for unknown destinations.
 */

import { createLogger } from '@main/log'
import type { IpcService } from '@main/services/ipc'
import type { WindowService } from '@main/services/window'
import type { DeeplinkRouteHandler } from './types'

const log = createLogger('Deeplink')

export const OPEN_DEEPLINK_ROUTE = '/open/*destination' as const

/** The renderer must be able to receive the event before it is sent. */
const RENDERER_READY_TIMEOUT_MS = 10_000

export function createOpenRoute(
  ipc: IpcService,
  window: WindowService
): DeeplinkRouteHandler<typeof OPEN_DEEPLINK_ROUTE> {
  return async (context) => {
    const path = `/${context.params.destination}`

    const ready = await window.mainWindow.whenRendererReady(RENDERER_READY_TIMEOUT_MS)
    if (!ready) {
      return {
        status: 'failed',
        message: 'Renderer did not become ready to receive the open destination.'
      }
    }

    ipc.send('deeplink:open', { path, query: context.query })
    log.info('Open destination forwarded.', { destinationPath: path })
    return { status: 'handled' }
  }
}
