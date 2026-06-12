/**
 * Protocol Registration
 *
 * Registers custom schemes for the application:
 * - attachment:// - Serves database attachments (images, backups)
 * - kisaki-extension-icon:// - Lazily proxies extension catalog icons
 * - kisaki-extension-ui:// - Serves bundled extension webview UI assets
 * - kisaki:// - Deeplink protocol for external triggers
 *
 * Custom schemes must be registered before app.whenReady().
 * Their handlers are set up by the owning services.
 */

import { protocol } from 'electron'

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
        bypassCSP: true,
        stream: true
      }
    }
  ])
}

export { DEEPLINK_SCHEME, EXTENSION_ICON_SCHEME, EXTENSION_UI_SCHEME }
