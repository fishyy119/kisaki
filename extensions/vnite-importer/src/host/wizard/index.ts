import {
  createWebviewRpc,
  kisaki,
  type ExtensionContext,
  type WebviewHandle
} from '@kisaki3/extension-sdk'
import {
  VNITE_IMPORT_WIZARD_ENTRY,
  type VniteImportWizardHostFunctions,
  type VniteImportWizardUiFunctions
} from '../../shared/import-wizard'
import {
  createVniteImportWizardFunctions,
  prepareVniteImportWizardSession,
  type VniteImportWizardRuntime
} from './functions'

export * from './store'
export * from './preview-games'
export * from './diagnostics'
export type { VniteImportWizardRuntime } from './functions'

/**
 * Registers the import wizard card action and manages the singleton wizard
 * webview session.
 */
export function registerVniteImportWizard(
  context: ExtensionContext,
  runtime: VniteImportWizardRuntime
): void {
  let current: WebviewHandle | null = null

  context.contributions.cardActions.register({
    id: 'import-wizard',
    label: '导入',
    description: '从 Vnite 备份包导入资料库。',
    async run() {
      if (current) {
        return
      }

      await prepareVniteImportWizardSession(runtime)

      const webview = await kisaki.webviews.open({
        entry: VNITE_IMPORT_WIZARD_ENTRY,
        title: 'Vnite 导入',
        surface: { kind: 'dialog', size: 'lg' }
      })
      current = webview
      webview.onClose(() => {
        current = null
      })

      createWebviewRpc<VniteImportWizardUiFunctions, VniteImportWizardHostFunctions>(
        webview,
        createVniteImportWizardFunctions(runtime)
      )
    }
  })
}
