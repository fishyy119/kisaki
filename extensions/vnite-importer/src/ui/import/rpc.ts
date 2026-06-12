import { createWebviewRpc, webview } from '@kisaki3/extension-sdk/webview'
import type { VniteImportWizardHostFunctions } from '../../shared/import-wizard'

export const host = createWebviewRpc<VniteImportWizardHostFunctions>(webview)

export function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Vnite 导入操作失败。'
}
