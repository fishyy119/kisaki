import { createWebviewRpc, kisaki, type ExtensionContext } from '@kisaki3/extension-sdk'
import { MAL_SETTINGS_ENTRY, type MalSettingsHostFunctions } from '../../shared/settings'
import { localizedMessage, m } from '../i18n'
import { createMalSettingsHostFunctions } from './host'
import type { MalSettingsRuntime } from './runtime'

export type { MalSettingsRuntime } from './runtime'

const SETTINGS_DIALOG_ID = 'settings'

/**
 * Declares the settings dialog and the card action that opens it. Every read
 * the dialog makes goes back to the stores, so nothing is captured here and
 * the document always shows what the extension is actually using.
 */
export function registerMalSettingsUi(
  context: ExtensionContext,
  runtime: MalSettingsRuntime
): void {
  const dialog = context.contributions.webviews.dialogs.register({
    id: SETTINGS_DIALOG_ID,
    title: localizedMessage((messages) => messages.settings.webviewTitle),
    entry: MAL_SETTINGS_ENTRY,
    size: 'lg'
  })

  dialog.onOpen((webview) => {
    createWebviewRpc<Record<never, never>, MalSettingsHostFunctions>(
      webview,
      createMalSettingsHostFunctions(runtime)
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
