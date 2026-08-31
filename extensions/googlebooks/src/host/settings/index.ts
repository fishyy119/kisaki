import { createWebviewRpc, kisaki, type ExtensionContext } from '@kisaki3/extension-sdk'
import {
  GBOOKS_SETTINGS_ENTRY,
  type GbooksSettingsHostFunctions,
  type GbooksSettingsUiFunctions
} from '../../shared/settings'
import { localizedMessage, m } from '../i18n'
import { createGbooksSettingsHostFunctions } from './host'
import { GbooksSettingsSession } from './session'
import type { GbooksSettingsRuntime } from './runtime'

export type { GbooksSettingsRuntime } from './runtime'

const SETTINGS_DIALOG_ID = 'settings'

export interface GbooksSettingsUiHandle {
  /** Pushes a refresh into the open settings dialog after a deeplink sign-in settles. */
  notifyOauthSettled(outcome: 'completed' | 'failed'): void
}

/**
 * Declares the settings dialog and the card action that opens it. Every read
 * the dialog makes goes back to the stores, so nothing is captured here and
 * the document always shows what the extension is actually using. OAuth
 * deeplink outcomes push a refresh into the open document.
 */
export function registerGbooksSettingsUi(
  context: ExtensionContext,
  runtime: GbooksSettingsRuntime
): GbooksSettingsUiHandle {
  const session = new GbooksSettingsSession(runtime.logger)

  const dialog = context.contributions.webviews.dialogs.register({
    id: SETTINGS_DIALOG_ID,
    title: localizedMessage((messages) => messages.settings.webviewTitle),
    entry: GBOOKS_SETTINGS_ENTRY,
    size: 'lg'
  })

  dialog.onOpen((webview) => {
    webview.onClose(() => {
      session.detach()
    })

    const remote = createWebviewRpc<GbooksSettingsUiFunctions, GbooksSettingsHostFunctions>(
      webview,
      createGbooksSettingsHostFunctions(runtime)
    )
    session.attach(remote)
  })

  context.contributions.cardActions.register({
    id: 'settings',
    label: m().settings.commandLabel,
    description: m().settings.commandDescription,
    async run() {
      await kisaki.webviews.openDialog(SETTINGS_DIALOG_ID)
    }
  })

  return {
    notifyOauthSettled(outcome) {
      session.pushRefresh(`oauth-${outcome}`)
    }
  }
}
