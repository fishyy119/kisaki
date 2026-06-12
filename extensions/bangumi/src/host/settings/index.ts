import {
  createWebviewRpc,
  kisaki,
  type ExtensionContext,
  type WebviewHandle,
  type WebviewRpcRemote
} from '@kisaki3/extension-sdk'
import {
  BANGUMI_SETTINGS_ENTRY,
  type BangumiSettingsHostFunctions,
  type BangumiSettingsUiFunctions
} from '../../shared/settings'
import { createBangumiSettingsHostFunctions, type BangumiSettingsRuntime } from './host'

export type { BangumiSettingsRuntime } from './host'

export interface BangumiSettingsUiHandle {
  notifyOauthCompleted(): void
}

/**
 * Registers the settings card action and manages the singleton settings
 * webview session.
 */
export function registerBangumiSettingsUi(
  context: ExtensionContext,
  runtime: BangumiSettingsRuntime
): BangumiSettingsUiHandle {
  let current: WebviewHandle | null = null
  let ui: WebviewRpcRemote<BangumiSettingsUiFunctions> | null = null

  context.contributions.cardActions.register({
    id: 'settings',
    label: '设置',
    description: '打开 Bangumi 集成设置。',
    async run() {
      if (current) {
        return
      }

      const webview = await kisaki.webviews.open({
        entry: BANGUMI_SETTINGS_ENTRY,
        title: 'Bangumi 集成',
        surface: { kind: 'dialog', size: 'lg' }
      })
      current = webview
      webview.onClose(() => {
        current = null
        ui = null
      })

      ui = createWebviewRpc<BangumiSettingsUiFunctions, BangumiSettingsHostFunctions>(
        webview,
        createBangumiSettingsHostFunctions(runtime)
      )
    }
  })

  return {
    notifyOauthCompleted() {
      void ui?.refreshRequested('oauth-completed').catch(() => undefined)
    }
  }
}
