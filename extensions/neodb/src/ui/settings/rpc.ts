import { createWebviewRpc, webview } from '@kisaki3/extension-sdk/webview'
import { m } from './i18n'
import type { NeodbSettingsHostFunctions } from '../../shared/settings'

export const host = createWebviewRpc<NeodbSettingsHostFunctions>(webview)

export function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : m.value.ui.actionFailed
}
