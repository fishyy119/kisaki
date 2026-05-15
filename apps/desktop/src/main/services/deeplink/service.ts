/**
 * Deeplink Service
 *
 * Handles kisaki:// protocol deeplinks for the application.
 * Supports launching games, extension callbacks, auth callbacks, navigation, and more.
 */

import { app } from 'electron'
import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { DeeplinkRouter } from './router'
import type { DeeplinkResult, DeeplinkRouteHandler, ParsedDeeplink } from './types'
import { DEEPLINK_SCHEME } from '@main/bootstrap/protocol'
import type { IpcService } from '@main/services/ipc'
import type { WindowService } from '@main/services/window'
import { AUTH_DEEPLINK_ROUTE, AuthHandler } from './handlers/auth'
import { LAUNCH_DEEPLINK_ROUTE, LaunchHandler } from './handlers/launch'
import { NAVIGATE_DEEPLINK_ROUTE, NavigateHandler } from './handlers/navigate'
import { registerDeeplinkIpc } from './ipc'

const log = createLogger('Deeplink')

export class DeeplinkService implements IService {
  readonly id = 'deeplink'
  readonly deps = ['ipc', 'window', 'launcher'] as const satisfies readonly ServiceName[]

  private router!: DeeplinkRouter
  private ipc!: IpcService
  private windowService!: WindowService
  private pendingDeeplinks: ParsedDeeplink[] = []
  private isReady = false

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.ipc = container.get('ipc')
    this.windowService = container.get('window')

    const launcher = container.get('launcher')

    this.router = new DeeplinkRouter()
    this.registerRoute(LAUNCH_DEEPLINK_ROUTE, new LaunchHandler(launcher))
    this.registerRoute(AUTH_DEEPLINK_ROUTE, new AuthHandler(this.ipc, this.windowService))
    this.registerRoute(NAVIGATE_DEEPLINK_ROUTE, new NavigateHandler(this.ipc, this.windowService))

    registerDeeplinkIpc(this, this.ipc)

    // Setup second-instance handler (Windows/Linux)
    this.setupSecondInstance()

    // Setup open-url handler (macOS)
    this.setupOpenUrl()

    log.info('Initialized')
  }

  registerRoute<const TPattern extends string>(
    pattern: TPattern,
    handler: DeeplinkRouteHandler<TPattern>
  ): () => void {
    return this.router.register(pattern, handler)
  }

  listRoutes(): { pattern: string }[] {
    return this.router.listRoutes()
  }

  /**
   * Mark the service as ready and process any pending deeplinks.
   * Should be called after all services are initialized and window is created.
   */
  markReady(): void {
    this.isReady = true

    // Process any deeplinks that arrived before we were ready
    for (const deeplink of this.pendingDeeplinks) {
      this.routeDeeplink(deeplink).catch((error) => {
        log.error('Error processing pending deeplink:', error)
      })
    }
    this.pendingDeeplinks = []

    log.info('Ready, processed pending deeplinks')
  }

  /**
   * Handle a deeplink URL
   */
  async handleDeeplink(url: string): Promise<DeeplinkResult> {
    const parsed = this.parseDeeplink(url)
    if (!parsed) {
      log.warn('Invalid deeplink format.', { url: url })
      return {
        success: false,
        message: 'Invalid deeplink format'
      }
    }

    // Queue if not ready yet
    if (!this.isReady) {
      log.info('Queuing deeplink (not ready).', { parsedPath: parsed.path })
      this.pendingDeeplinks.push(parsed)
      return {
        success: true,
        path: parsed.path,
        message: 'Queued for processing'
      }
    }

    return this.routeDeeplink(parsed)
  }

  private async routeDeeplink(deeplink: ParsedDeeplink): Promise<DeeplinkResult> {
    try {
      log.info('Handling.', { deeplinkPath: deeplink.path })
      return await this.router.route(deeplink)
    } catch (error) {
      log.error('Error handling deeplink:', error)
      return {
        success: false,
        path: deeplink.path,
        message: (error as Error).message
      }
    }
  }

  /**
   * Parse a deeplink URL into its components
   */
  private parseDeeplink(url: string): ParsedDeeplink | null {
    try {
      const parsed = new URL(url)

      // Verify protocol
      if (parsed.protocol !== `${DEEPLINK_SCHEME}:`) {
        return null
      }

      const hostPath = parsed.hostname ? `/${parsed.hostname}` : ''
      const routePath = `${hostPath}${parsed.pathname || ''}`
      if (!routePath) {
        return null
      }
      const query: Record<string, string> = {}

      parsed.searchParams.forEach((value, key) => {
        query[key] = value
      })

      return { path: routePath, query, rawUrl: url }
    } catch {
      return null
    }
  }

  /**
   * Setup handler for second-instance event (Windows/Linux)
   */
  private setupSecondInstance(): void {
    app.on('second-instance', (_event, argv) => {
      // Find kisaki:// URL in arguments
      const deeplinkUrl = argv.find((arg) => arg.startsWith(`${DEEPLINK_SCHEME}://`))
      if (deeplinkUrl) {
        this.handleDeeplink(deeplinkUrl).catch((error) => {
          log.error('Error handling second-instance deeplink:', error)
        })
      }

      // Focus the main window
      this.focusMainWindow()
    })
  }

  /**
   * Setup handler for open-url event (macOS)
   */
  private setupOpenUrl(): void {
    app.on('open-url', (event, url) => {
      event.preventDefault()
      this.handleDeeplink(url).catch((error) => {
        log.error('Error handling open-url deeplink:', error)
      })
    })
  }

  /**
   * Focus the main window
   */
  private focusMainWindow(): void {
    try {
      const mainWindow = this.windowService.getMainWindow()
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
    } catch (error) {
      log.error('Error focusing main window:', error)
    }
  }
}
