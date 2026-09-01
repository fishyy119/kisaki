/**
 * Pre-init capture of `open-url` deeplinks.
 *
 * macOS delivers `open-url` as soon as the process exists — before services
 * initialize, and for URL-triggered cold starts even before `app.whenReady()`
 * resolves. The main entry installs this capture at module scope; the
 * deeplink service drains the buffer (and removes the listener) during init.
 */

import { app } from 'electron'

const capturedUrls: string[] = []
let capture: ((event: Electron.Event, url: string) => void) | null = null

export function installDeeplinkCapture(): void {
  if (capture) {
    return
  }

  capture = (event, url) => {
    event.preventDefault()
    capturedUrls.push(url)
  }
  app.on('open-url', capture)
}

export function drainCapturedDeeplinkUrls(): string[] {
  if (capture) {
    app.off('open-url', capture)
    capture = null
  }
  return capturedUrls.splice(0)
}
