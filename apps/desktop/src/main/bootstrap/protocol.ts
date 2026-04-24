/**
 * Protocol Registration
 *
 * Registers custom schemes for the application:
 * - attachment:// - Serves database attachments (images, backups)
 * - kisaki:// - Deeplink protocol for external triggers
 *
 * The attachment scheme must be registered before app.whenReady().
 * Its handler is set up by the attachment service.
 */

import { protocol } from 'electron'

const ATTACHMENT_SCHEME = 'attachment'
const DEEPLINK_SCHEME = 'kisaki'

/**
 * Register schemes as privileged.
 * Must be called before app.whenReady().
 *
 * Note: kisaki:// deeplink scheme is registered via app.setAsDefaultProtocolClient()
 * in the main entry point, not here.
 */
export function registerAttachmentScheme(): void {
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
    }
  ])
}

export { DEEPLINK_SCHEME }
