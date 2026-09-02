/**
 * Deeplink Service
 *
 * Owns every OS entry point of `kisaki://` messages — startup argv
 * (Windows/Linux), second-instance argv, and macOS `open-url` including the
 * pre-init URLs buffered by `bootstrap/deeplink-capture` — queues requests
 * until the app is ready, and dispatches them through the single router.
 *
 * Routes are registered by their owners: this service owns only `open`;
 * domain services (`launch`) and the extension system (`ext`) register
 * theirs. Requests are processed sequentially in arrival order.
 *
 * Outcome policy: every settled request is logged here exactly once. The
 * user is notified only for failures nobody else owns (invalid or unmatched
 * links); a failed handler owns its own user feedback. Window focus is
 * driven by per-route registration metadata.
 */

import { app } from 'electron'
import { createLogger } from '@main/log'
import type { INonDomainService, ServiceInitContainer } from '@main/container'
import { DEEPLINK_SCHEME, parseDeeplinkUrl, type DeeplinkRequest } from '@shared/deeplink'
import { drainCapturedDeeplinkUrls } from '@main/bootstrap/deeplink-capture'
import type { WindowService } from '@main/services/window'
import type { NotificationService } from '@main/services/notification'
import type { I18nService } from '@main/services/i18n'
import { DeeplinkRouter } from './router'
import { createOpenRoute, OPEN_DEEPLINK_ROUTE } from './open-route'

const log = createLogger('Deeplink')

export class DeeplinkService implements INonDomainService<'deeplink'> {
  readonly id = 'deeplink'
  readonly deps = ['ipc', 'window', 'notification', 'i18n'] as const

  router!: DeeplinkRouter
  private windowService!: WindowService
  private notification!: NotificationService
  private i18n!: I18nService
  private pending: DeeplinkRequest[] = []
  private isReady = false
  private processing: Promise<void> = Promise.resolve()
  private onSecondInstance?: (event: Electron.Event, argv: string[]) => void
  private onOpenUrl?: (event: Electron.Event, url: string) => void

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.windowService = container.get('window')
    this.notification = container.get('notification')
    this.i18n = container.get('i18n')

    this.router = new DeeplinkRouter()
    this.router.register(
      OPEN_DEEPLINK_ROUTE,
      createOpenRoute(container.get('ipc'), this.windowService),
      { focus: true }
    )

    this.onSecondInstance = (_event, argv) => {
      const url = findDeeplinkArg(argv)
      if (url) {
        this.handle(url)
      }
    }
    app.on('second-instance', this.onSecondInstance)

    this.onOpenUrl = (event, url) => {
      event.preventDefault()
      this.handle(url)
    }
    app.on('open-url', this.onOpenUrl)

    // URLs that arrived before this service existed (macOS cold starts).
    for (const url of drainCapturedDeeplinkUrls()) {
      this.handle(url)
    }

    log.info('Initialized')
  }

  /** Called by the composition root once every route owner has registered. */
  markReady(): void {
    this.isReady = true

    // Windows/Linux cold starts deliver the triggering URL via argv.
    const startupUrl = findDeeplinkArg(process.argv)
    if (startupUrl) {
      this.handle(startupUrl)
    }

    const queued = this.pending
    this.pending = []
    for (const request of queued) {
      this.enqueue(request)
    }

    log.info('Ready, queued deeplinks dispatched.', { queuedCount: queued.length })
  }

  /** Fire-and-forget entry: a deeplink has no sender to answer to. */
  handle(url: string): void {
    const request = parseDeeplinkUrl(url)
    if (!request) {
      // A malformed deeplink may carry token-like query values; log only a
      // low-sensitivity descriptor, never the raw URL.
      log.warn('Rejected invalid deeplink.', { urlDescriptor: describeUrlForLog(url) })
      const messages = this.i18n.messages.deeplink
      this.notification.show({
        title: messages.invalidLinkTitle,
        message: messages.invalidLinkMessage,
        type: 'error',
        target: 'auto'
      })
      return
    }

    if (!this.isReady) {
      log.info('Queued deeplink until ready.', { requestPath: request.path })
      this.pending.push(request)
      return
    }

    this.enqueue(request)
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

    this.pending = []
    this.isReady = false

    log.info('Disposed')
  }

  /** External commands are causally unrelated but processed in arrival order. */
  private enqueue(request: DeeplinkRequest): void {
    this.processing = this.processing.then(() => this.dispatch(request))
  }

  private async dispatch(request: DeeplinkRequest): Promise<void> {
    const match = this.router.match(request)
    if (!match) {
      log.warn('No deeplink route matched.', { requestPath: request.path })
      const messages = this.i18n.messages.deeplink
      this.notification.show({
        title: messages.unknownLinkTitle,
        message: messages.unknownLinkMessage,
        type: 'error',
        target: 'auto'
      })
      return
    }

    if (match.focus) {
      this.windowService.mainWindow.focus()
    }

    const outcome = await match.execute()
    if (outcome.status === 'handled') {
      log.info('Deeplink handled.', { requestPath: request.path, routePattern: match.pattern })
      return
    }

    // The owning handler already surfaced user feedback for its failure.
    log.warn('Deeplink failed.', {
      requestPath: request.path,
      routePattern: match.pattern,
      failureMessage: outcome.message
    })
  }
}

function findDeeplinkArg(argv: readonly string[]): string | undefined {
  return argv.find((arg) => arg.startsWith(`${DEEPLINK_SCHEME}://`))
}

/** Low-sensitivity descriptor of a rejected deeplink: pathname or length only. */
function describeUrlForLog(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return `<unparsable url, length ${url.length}>`
  }
}
