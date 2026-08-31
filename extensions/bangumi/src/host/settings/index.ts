import { createWebviewRpc, kisaki, type ExtensionContext } from '@kisaki3/extension-sdk'
import {
  BANGUMI_SETTINGS_ENTRY,
  type BangumiSettingsHostFunctions,
  type BangumiSettingsUiFunctions
} from '../../shared/settings'
import { createBangumiSettingsHostFunctions } from './host'
import { localizedMessage, m } from '../i18n'
import { BangumiSettingsSession } from './session'
import type { BangumiSettingsRuntime } from './runtime'

export type { BangumiSettingsRuntime } from './runtime'

const SETTINGS_DIALOG_ID = 'settings'

export interface BangumiSettingsUiHandle {
  /** Pushes a refresh into the open settings dialog after a deeplink sign-in settles. */
  notifyOauthSettled(outcome: 'completed' | 'failed'): void
}

/**
 * Declares the settings dialog and registers the card action that opens it.
 * The dialog is wired once through `onOpen`; the app keeps at most one live
 * session per declared dialog, so repeated triggers adopt the open one. Job
 * lifecycle events push refreshes into the open document so account and
 * active-job state stay live.
 */
export function registerBangumiSettingsUi(
  context: ExtensionContext,
  runtime: BangumiSettingsRuntime
): BangumiSettingsUiHandle {
  const session = new BangumiSettingsSession(runtime.logger)

  context.subscriptions.add(
    runtime.jobEvents.subscribe((event) => {
      session.pushRefresh(event.type === 'started' ? 'job-started' : 'job-finished')
    })
  )

  const dialog = context.contributions.webviews.dialogs.register({
    id: SETTINGS_DIALOG_ID,
    title: localizedMessage((messages) => messages.settings.webviewTitle),
    entry: BANGUMI_SETTINGS_ENTRY,
    size: 'xl'
  })

  dialog.onOpen((webview) => {
    webview.onClose(() => {
      session.detach()
    })

    const remote = createWebviewRpc<BangumiSettingsUiFunctions, BangumiSettingsHostFunctions>(
      webview,
      createBangumiSettingsHostFunctions(runtime, session)
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
