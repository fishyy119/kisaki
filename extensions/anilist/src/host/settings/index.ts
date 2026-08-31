import { createWebviewRpc, kisaki, type ExtensionContext } from '@kisaki3/extension-sdk'
import {
  ANILIST_SETTINGS_ENTRY,
  type AnilistSettingsHostFunctions,
  type AnilistSettingsUiFunctions
} from '../../shared/settings'
import { localizedMessage, m } from '../i18n'
import { createAnilistSettingsHostFunctions } from './host'
import { AnilistSettingsSession } from './session'
import type { AnilistSettingsRuntime } from './runtime'

export type { AnilistSettingsRuntime } from './runtime'

const SETTINGS_DIALOG_ID = 'settings'

export interface AnilistSettingsUiHandle {
  /** Pushes a refresh into the open settings dialog after a deeplink sign-in settles. */
  notifyOauthSettled(outcome: 'completed' | 'failed'): void
}

/**
 * Declares the settings dialog and the card action that opens it. Every read
 * the dialog makes goes back to the stores, so nothing is captured here and
 * the document always shows what the extension is actually using. OAuth
 * deeplink outcomes push a refresh into the open document.
 */
export function registerAnilistSettingsUi(
  context: ExtensionContext,
  runtime: AnilistSettingsRuntime
): AnilistSettingsUiHandle {
  const session = new AnilistSettingsSession(runtime.logger)

  const dialog = context.contributions.webviews.dialogs.register({
    id: SETTINGS_DIALOG_ID,
    title: localizedMessage((messages) => messages.settings.webviewTitle),
    entry: ANILIST_SETTINGS_ENTRY,
    size: 'lg'
  })

  dialog.onOpen((webview) => {
    webview.onClose(() => {
      session.detach()
    })

    const remote = createWebviewRpc<AnilistSettingsUiFunctions, AnilistSettingsHostFunctions>(
      webview,
      createAnilistSettingsHostFunctions(runtime)
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
