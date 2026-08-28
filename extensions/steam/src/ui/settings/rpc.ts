import { createWebviewRpc, webview } from '@kisaki3/extension-sdk/webview'
import { m } from './i18n'
import type { SteamSettingsHostFunctions } from '../../shared/settings'

export const host = createWebviewRpc<SteamSettingsHostFunctions>(webview)

export function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : m.value.ui.actionFailed
}
