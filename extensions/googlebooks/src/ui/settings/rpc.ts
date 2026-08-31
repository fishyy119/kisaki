import { createWebviewRpc, webview } from '@kisaki3/extension-sdk/webview'
import { m } from './i18n'
import type { GbooksSettingsHostFunctions, GbooksSettingsUiFunctions } from '../../shared/settings'

type RefreshListener = (reason: string) => void

const refreshListeners = new Set<RefreshListener>()

export const host = createWebviewRpc<GbooksSettingsHostFunctions, GbooksSettingsUiFunctions>(
  webview,
  {
    refreshRequested(reason) {
      for (const listener of refreshListeners) {
        listener(reason)
      }
    }
  }
)

export function onHostRefreshRequested(listener: RefreshListener): () => void {
  refreshListeners.add(listener)
  return () => {
    refreshListeners.delete(listener)
  }
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : m.value.ui.actionFailed
}
