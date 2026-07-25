import {
  createWebviewRpc,
  kisaki,
  type ExtensionContext,
  type WebviewHandle
} from '@kisaki3/extension-sdk'
import {
  BANGUMI_SETTINGS_ENTRY,
  type BangumiSettingsHostFunctions,
  type BangumiSettingsUiFunctions
} from '../../shared/settings'
import { createBangumiSettingsHostFunctions } from './host'
import { m } from '../i18n'
import { BangumiSettingsSession } from './session'
import type { BangumiSettingsRuntime } from './runtime'

export type { BangumiSettingsRuntime } from './runtime'

export interface BangumiSettingsUiHandle {
  notifyOauthCompleted(): void
}

/**
 * Registers the settings card action and manages the singleton settings
 * webview session. Job lifecycle events push refreshes into the open
 * document so account and active-job state stay live.
 */
export function registerBangumiSettingsUi(
  context: ExtensionContext,
  runtime: BangumiSettingsRuntime
): BangumiSettingsUiHandle {
  const session = new BangumiSettingsSession(runtime.logger)
  let current: WebviewHandle | null = null

  context.subscriptions.add(
    runtime.jobEvents.subscribe((event) => {
      session.pushRefresh(event.type === 'started' ? 'job-started' : 'job-finished')
    })
  )

  context.contributions.cardActions.register({
    id: 'settings',
    label: m().settings.commandLabel,
    description: m().settings.commandDescription,
    async run() {
      if (current) {
        return
      }

      const webview = await kisaki.webviews.open({
        entry: BANGUMI_SETTINGS_ENTRY,
        title: m().settings.webviewTitle,
        surface: { kind: 'dialog', size: 'xl' }
      })
      current = webview
      webview.onClose(() => {
        current = null
        session.detach()
      })

      const remote = createWebviewRpc<BangumiSettingsUiFunctions, BangumiSettingsHostFunctions>(
        webview,
        createBangumiSettingsHostFunctions(runtime, session)
      )
      session.attach(remote)
    }
  })

  return {
    notifyOauthCompleted() {
      session.pushRefresh('oauth-completed')
    }
  }
}
