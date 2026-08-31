import { createWebviewRpc, kisaki, type ExtensionContext } from '@kisaki3/extension-sdk'
import {
  NEODB_SETTINGS_ENTRY,
  type NeodbSettingsHostFunctions,
  type NeodbSettingsUiFunctions
} from '../../shared/settings'
import { localizedMessage, m } from '../i18n'
import { createNeodbSettingsHostFunctions } from './host'
import { NeodbSettingsSession } from './session'
import type { NeodbSettingsRuntime } from './runtime'

export type { NeodbSettingsRuntime } from './runtime'

const SETTINGS_DIALOG_ID = 'settings'

export interface NeodbSettingsUiHandle {
  /** Pushes a refresh into the open settings dialog after a deeplink sign-in settles. */
  notifyOauthSettled(outcome: 'completed' | 'failed'): void
}

/**
 * Declares the settings dialog and the card action that opens it. Every read
 * the dialog makes goes back to the stores, so nothing is captured here and
 * the document always shows what the extension is actually using. OAuth
 * deeplink outcomes push a refresh into the open document.
 */
export function registerNeodbSettingsUi(
  context: ExtensionContext,
  runtime: NeodbSettingsRuntime
): NeodbSettingsUiHandle {
  const session = new NeodbSettingsSession(runtime.logger)

  const dialog = context.contributions.webviews.dialogs.register({
    id: SETTINGS_DIALOG_ID,
    title: localizedMessage((messages) => messages.settings.webviewTitle),
    entry: NEODB_SETTINGS_ENTRY,
    size: 'lg'
  })

  dialog.onOpen((webview) => {
    webview.onClose(() => {
      session.detach()
    })

    const remote = createWebviewRpc<NeodbSettingsUiFunctions, NeodbSettingsHostFunctions>(
      webview,
      createNeodbSettingsHostFunctions(runtime)
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
