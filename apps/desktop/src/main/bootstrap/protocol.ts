/**
 * Protocol Registration
 *
 * Registers custom schemes for the application:
 * - attachment:// - Serves database attachments (images, backups)
 * - book:// - Streams reading content out of unit file rows
 * - kisaki-extension-icon:// - Lazily proxies extension catalog icons
 * - kisaki-extension-ui:// - Serves packaged and proxied development extension UI assets
 * - kisaki-extension-file:// - Serves installed extension package files (icons)
 * - kisaki-webview-font:// - Serves app fonts to extension webview documents
 *
 * The kisaki:// deeplink scheme is not registered here: its constant lives in
 * `@shared/deeplink` and the main entry registers it via
 * app.setAsDefaultProtocolClient().
 *
 * Custom schemes must be registered before app.whenReady().
 * Their handlers are set up by the owning services.
 */

import { protocol } from 'electron'
import { EXTENSION_WEBVIEW_FONT_SCHEME } from '@shared/extension'
import { BOOK_SCHEME } from '@shared/book'

const ATTACHMENT_SCHEME = 'attachment'
const EXTENSION_ICON_SCHEME = 'kisaki-extension-icon'
const EXTENSION_UI_SCHEME = 'kisaki-extension-ui'
const EXTENSION_FILE_SCHEME = 'kisaki-extension-file'

/**
 * Register schemes as privileged.
 * Must be called before app.whenReady().
 */
export function registerAppSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ATTACHMENT_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        bypassCSP: true,
        stream: true,
        // Ambient color extraction decodes covers as crossOrigin="anonymous"
        // images so canvas pixel reads stay untainted; those requests are
        // CORS-gated, so the scheme must participate in CORS.
        corsEnabled: true
      }
    },
    {
      scheme: BOOK_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        bypassCSP: true,
        stream: true,
        // Reader windows keep web security on, so the reading engines fetch
        // book bytes cross-origin; the scheme must participate in CORS.
        corsEnabled: true
      }
    },
    {
      scheme: EXTENSION_ICON_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        bypassCSP: true,
        stream: true
      }
    },
    {
      scheme: EXTENSION_UI_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        // Extension documents run inside a sandboxed, extension-scoped iframe
        // and must execute independently from the app renderer's CSP.
        bypassCSP: true,
        stream: true
      }
    },
    {
      scheme: EXTENSION_FILE_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        bypassCSP: true,
        stream: true
      }
    },
    {
      scheme: EXTENSION_WEBVIEW_FONT_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        bypassCSP: true,
        stream: true,
        // Webview documents load fonts cross-origin; @font-face requests are
        // CORS-gated, so the scheme must participate in CORS.
        corsEnabled: true
      }
    }
  ])
}

export { EXTENSION_FILE_SCHEME, EXTENSION_ICON_SCHEME, EXTENSION_UI_SCHEME }
