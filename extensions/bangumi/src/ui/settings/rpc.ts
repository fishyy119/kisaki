import { createWebviewRpc, webview } from '@kisaki3/extension-sdk/webview'
import type {
  BangumiSettingsHostFunctions,
  BangumiSettingsUiFunctions
} from '../../shared/settings'

type RefreshListener = (reason: string) => void
type PreviewProgressListener = (label: string) => void

const refreshListeners = new Set<RefreshListener>()
const previewProgressListeners = new Set<PreviewProgressListener>()

export const host = createWebviewRpc<BangumiSettingsHostFunctions, BangumiSettingsUiFunctions>(
  webview,
  {
    refreshRequested(reason) {
      for (const listener of refreshListeners) {
        listener(reason)
      }
    },
    previewProgress(label) {
      for (const listener of previewProgressListeners) {
        listener(label)
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

export function onHostPreviewProgress(listener: PreviewProgressListener): () => void {
  previewProgressListeners.add(listener)
  return () => {
    previewProgressListeners.delete(listener)
  }
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '操作失败，请重试。'
}
