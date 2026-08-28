import { createWebviewRpc, kisaki, type ExtensionContext } from '@kisaki3/extension-sdk'
import { MANGADEX_SETTINGS_ENTRY, type MangadexSettingsHostFunctions } from '../../shared/settings'
import { localizedMessage, m } from '../i18n'
import { createMangadexSettingsHostFunctions } from './host'
import type { MangadexSettingsRuntime } from './runtime'

export type { MangadexSettingsRuntime } from './runtime'

const SETTINGS_DIALOG_ID = 'settings'

/**
 * Declares the settings dialog and the card action that opens it. Every read
 * the dialog makes goes back to the stores, so nothing is captured here and
 * the document always shows what the extension is actually using.
 */
export function registerMangadexSettingsUi(
  context: ExtensionContext,
  runtime: MangadexSettingsRuntime
): void {
  const dialog = context.contributions.webviews.dialogs.register({
    id: SETTINGS_DIALOG_ID,
    title: localizedMessage((messages) => messages.settings.webviewTitle),
    entry: MANGADEX_SETTINGS_ENTRY,
    size: 'lg'
  })

  dialog.onOpen((webview) => {
    createWebviewRpc<Record<never, never>, MangadexSettingsHostFunctions>(
      webview,
      createMangadexSettingsHostFunctions(runtime)
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
