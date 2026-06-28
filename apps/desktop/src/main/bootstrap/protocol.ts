/**
 * Protocol Registration
 *
 * Registers custom schemes for the application:
 * - attachment:// - Serves database attachments (images, backups)
 * - kisaki-extension-icon:// - Lazily proxies extension catalog icons
 * - kisaki-extension-ui:// - Serves packaged and proxied development extension UI assets
 * - kisaki-webview-font:// - Serves app fonts to extension webview documents
 * - kisaki:// - Deeplink protocol for external triggers
 *
 * Custom schemes must be registered before app.whenReady().
 * Their handlers are set up by the owning services.
 */

import { protocol } from 'electron'
import { EXTENSION_WEBVIEW_FONT_SCHEME } from '@shared/extension'

const ATTACHMENT_SCHEME = 'attachment'
const EXTENSION_ICON_SCHEME = 'kisaki-extension-icon'
const EXTENSION_UI_SCHEME = 'kisaki-extension-ui'
const DEEPLINK_SCHEME = 'kisaki'

/**
 * Register schemes as privileged.
 * Must be called before app.whenReady().
 *
 * Note: kisaki:// deeplink scheme is registered via app.setAsDefaultProtocolClient()
 * in the main entry point, not here.
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
        stream: true
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

export { DEEPLINK_SCHEME, EXTENSION_ICON_SCHEME, EXTENSION_UI_SCHEME }
