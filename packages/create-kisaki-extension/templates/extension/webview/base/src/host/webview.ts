import { createWebviewRpc, kisaki, type ExtensionContext } from '@kisaki3/extension-sdk'
import type { HostFunctions, UiFunctions } from '../shared/contract'

const extensionName = `{{EXTENSION_NAME}}`

const MAIN_DIALOG_ID = 'main'

/**
 * Declares the sample webview dialog and registers the card action that
 * opens it. The dialog is wired once through `onOpen`; the app keeps at most
 * one live session per declared dialog, so repeated triggers adopt the open
 * one.
 */
export function registerWebview(context: ExtensionContext): void {
  const dialog = context.contributions.webviews.dialogs.register({
    id: MAIN_DIALOG_ID,
    title: extensionName,
    entry: 'main/index.html',
    size: 'md'
  })

  dialog.onOpen((webview) => {
    createWebviewRpc<UiFunctions, HostFunctions>(webview, createHostFunctions(context))
  })

  context.contributions.cardActions.register({
    id: 'open-webview',
    label: 'Open',
    description: `Open the ${extensionName} webview.`,
    async run() {
      await kisaki.webviews.openDialog(MAIN_DIALOG_ID)
    }
  })
}

function createHostFunctions(context: ExtensionContext): HostFunctions {
  return {
    async loadState() {
      return {
        enabled: (await context.storage.get<boolean>('enabled')) ?? true
      }
    },
    async saveState(state) {
      await context.storage.set('enabled', state.enabled)
    },
    async sendTestNotification() {
      await kisaki.notify.info(extensionName, 'Notification sent from the extension webview.')
    }
  }
}
