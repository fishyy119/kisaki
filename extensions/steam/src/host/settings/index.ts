import { createWebviewRpc, kisaki, type ExtensionContext } from '@kisaki3/extension-sdk'
import { STEAM_SETTINGS_ENTRY, type SteamSettingsHostFunctions } from '../../shared/settings'
import { localizedMessage, m } from '../i18n'
import { createSteamSettingsHostFunctions } from './host'
import type { SteamSettingsRuntime } from './runtime'

export type { SteamSettingsRuntime } from './runtime'

const SETTINGS_DIALOG_ID = 'settings'

/**
 * Declares the settings dialog and the card action that opens it. Every read
 * the dialog makes goes back to the stores, so nothing is captured here and
 * the document always shows what the extension is actually using.
 */
export function registerSteamSettingsUi(
  context: ExtensionContext,
  runtime: SteamSettingsRuntime
): void {
  const dialog = context.contributions.webviews.dialogs.register({
    id: SETTINGS_DIALOG_ID,
    title: localizedMessage((messages) => messages.settings.webviewTitle),
    entry: STEAM_SETTINGS_ENTRY,
    size: 'lg'
  })

  dialog.onOpen((webview) => {
    createWebviewRpc<Record<never, never>, SteamSettingsHostFunctions>(
      webview,
      createSteamSettingsHostFunctions(runtime)
    )
  })

  context.contributions.cardActions.register({
    id: 'settings',
    label: m().settings.commandLabel,
    description: m().settings.commandDescription,
    async run() {
      await kisaki.webviews.openDialog(SETTINGS_DIALOG_ID)
    }
  })
}
