import { createWebviewRpc, kisaki, type ExtensionContext } from '@kisaki3/extension-sdk'
import { NEODB_SETTINGS_ENTRY, type NeodbSettingsHostFunctions } from '../../shared/settings'
import { localizedMessage, m } from '../i18n'
import { createNeodbSettingsHostFunctions } from './host'
import type { NeodbSettingsRuntime } from './runtime'

export type { NeodbSettingsRuntime } from './runtime'

const SETTINGS_DIALOG_ID = 'settings'

/**
 * Declares the settings dialog and the card action that opens it. Every read
 * the dialog makes goes back to the stores, so nothing is captured here and
 * the document always shows what the extension is actually using.
 */
export function registerNeodbSettingsUi(
  context: ExtensionContext,
  runtime: NeodbSettingsRuntime
): void {
  const dialog = context.contributions.webviews.dialogs.register({
    id: SETTINGS_DIALOG_ID,
    title: localizedMessage((messages) => messages.settings.webviewTitle),
    entry: NEODB_SETTINGS_ENTRY,
    size: 'lg'
  })

  dialog.onOpen((webview) => {
    createWebviewRpc<Record<never, never>, NeodbSettingsHostFunctions>(
      webview,
      createNeodbSettingsHostFunctions(runtime)
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
