import { buildBuiltinExtensions } from '../builtin-extensions/build'
import { createBuiltinExtensionToolContext } from '../builtin-extensions/context'
import { buildWebviewFonts } from '../webview-fonts/build'
import { createWebviewFontToolContext } from '../webview-fonts/paths'
import { runProductionBundles } from './build'
import { ElectronAppController } from './electron'
import type { BundlerPaths } from './paths'

/** Builds production bundles and runs the app from out/ without a dev server. */
export async function runStartWorkflow(paths: BundlerPaths): Promise<void> {
  await buildWebviewFonts(createWebviewFontToolContext())
  await buildBuiltinExtensions(createBuiltinExtensionToolContext(), 'dev')
  await runProductionBundles(paths)

  const app = new ElectronAppController({
    desktopRoot: paths.desktopRoot,
    onExit: (code) => process.exit(code)
  })
  app.start()

  process.once('SIGINT', () => {
    app.dispose()
    process.exit(130)
  })
  process.once('SIGTERM', () => {
    app.dispose()
    process.exit(143)
  })

  await new Promise<void>(() => undefined)
}
