import {
  createWebviewRpc,
  defineExtension,
  kisaki,
  type ExtensionContext,
  type WebviewHandle
} from '@kisaki3/extension-sdk'
import type { HostFunctions, UiFunctions } from '../shared/contract'

const extensionName = `__EXTENSION_NAME__`

export default defineExtension({
  activate(context) {
    context.logger.info(`${extensionName} activated.`)

    let current: WebviewHandle | null = null

    context.contributions.cardActions.register({
      id: 'open-settings',
      label: 'Settings',
      description: `Open the ${extensionName} settings.`,
      async run() {
        if (current) {
          return
        }

        const webview = await kisaki.webviews.open({
          entry: 'main/index.html',
          title: extensionName,
          surface: { kind: 'dialog', size: 'md' }
        })
        current = webview
        webview.onClose(() => {
          current = null
        })

        createWebviewRpc<UiFunctions, HostFunctions>(webview, createHostFunctions(context))
      }
    })
  }
})

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
