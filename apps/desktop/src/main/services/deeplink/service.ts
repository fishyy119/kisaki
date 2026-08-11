/**
 * Deeplink Service
 *
 * Handles kisaki:// protocol URLs and owns the built-in route registration.
 */

import { app } from 'electron'
import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { DeeplinkRouter } from './router'
import type { DeeplinkResult, ParsedDeeplink } from './types'
import { DEEPLINK_SCHEME } from '@main/bootstrap/protocol'
import type { WindowService } from '@main/services/window'
import { AUTH_DEEPLINK_ROUTE, AuthHandler } from './handlers/auth'
import { LAUNCH_DEEPLINK_ROUTE, LaunchHandler } from './handlers/launch'
import { NAVIGATE_DEEPLINK_ROUTE, NavigateHandler } from './handlers/navigate'
import { registerDeeplinkIpc } from './ipc'

const log = createLogger('Deeplink')

export class DeeplinkService implements IService {
  readonly id = 'deeplink'
  readonly deps = [
    'activity',
    'i18n',
    'ipc',
    'notify',
    'window'
  ] as const satisfies readonly ServiceName[]

  router!: DeeplinkRouter
  private windowService!: WindowService
  private pendingDeeplinks: ParsedDeeplink[] = []
  private isReady = false
  private onSecondInstance?: (event: Electron.Event, argv: string[]) => void
  private onOpenUrl?: (event: Electron.Event, url: string) => void

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const ipc = container.get('ipc')
    this.windowService = container.get('window')
    const activity = container.get('activity')
    const notify = container.get('notify')
    const i18n = container.get('i18n')

    this.router = new DeeplinkRouter()

    this.router.register(LAUNCH_DEEPLINK_ROUTE, new LaunchHandler(activity, notify, i18n))
    this.router.register(AUTH_DEEPLINK_ROUTE, new AuthHandler(ipc, this.windowService))
    this.router.register(NAVIGATE_DEEPLINK_ROUTE, new NavigateHandler(ipc, this.windowService))

    registerDeeplinkIpc(this, ipc)
    this.setupSecondInstance()
    this.setupOpenUrl()

    log.info('Initialized')
  }

  markReady(): void {
    this.isReady = true

    const pending = this.pendingDeeplinks
    this.pendingDeeplinks = []

    for (const deeplink of pending) {
      this.routeDeeplink(deeplink).catch((error) => {
        log.error('Error processing pending deeplink:', error)
      })
    }

    log.info('Ready, processed pending deeplinks.', { count: pending.length })
  }

  async handleDeeplink(url: string): Promise<DeeplinkResult> {
    const parsed = this.parseDeeplink(url)
    if (!parsed) {
      // Malformed deeplinks may carry token-like query values; log the
      // pathname only, never the raw URL.
      log.warn('Invalid deeplink format.', { pathname: describeDeeplinkForLog(url) })
      return {
        success: false,
        message: 'Invalid deeplink format'
      }
    }

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

  async dispose(): Promise<void> {
    if (this.onSecondInstance) {
      app.off('second-instance', this.onSecondInstance)
      this.onSecondInstance = undefined
    }

    if (this.onOpenUrl) {
      app.off('open-url', this.onOpenUrl)
      this.onOpenUrl = undefined
    }

    this.pendingDeeplinks = []
    this.isReady = false

    log.info('Disposed')
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
        message: error instanceof Error ? error.message : 'Failed to handle deeplink.'
      }
    }
  }

  private parseDeeplink(url: string): ParsedDeeplink | null {
    try {
      const parsed = new URL(url)

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

  private setupSecondInstance(): void {
    if (this.onSecondInstance) {
      return
    }

    this.onSecondInstance = (_event, argv) => {
      const deeplinkUrl = argv.find((arg) => arg.startsWith(`${DEEPLINK_SCHEME}://`))
      if (deeplinkUrl) {
        this.handleDeeplink(deeplinkUrl).catch((error) => {
          log.error('Error handling second-instance deeplink:', error)
        })
      }

      this.focusMainWindow()
    }
    app.on('second-instance', this.onSecondInstance)
  }

  private setupOpenUrl(): void {
    if (this.onOpenUrl) {
      return
    }

    this.onOpenUrl = (event, url) => {
      event.preventDefault()
      this.handleDeeplink(url).catch((error) => {
        log.error('Error handling open-url deeplink:', error)
      })
    }
    app.on('open-url', this.onOpenUrl)
  }

  private focusMainWindow(): void {
    try {
      this.windowService.mainWindow.focus()
    } catch (error) {
      log.error('Error focusing main window:', error)
    }
  }
}

/** Low-sensitivity descriptor of a rejected deeplink: pathname or length only. */
function describeDeeplinkForLog(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return `<unparsable url, length ${url.length}>`
  }
}
