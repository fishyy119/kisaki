import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  EXTENSION_WEBVIEW_FONT_RESOURCE_DIR,
  type ExtensionWebviewFontPackage
} from '../../src/shared/extension/webview-fonts'

/** Shared filesystem paths for the webview font resource builder. */
export interface WebviewFontToolContext {
  readonly desktopRoot: string
  readonly resourceRoot: string
}

/** Creates the desktop path context used by webview font resource workflows. */
export function createWebviewFontToolContext(metaUrl = import.meta.url): WebviewFontToolContext {
  const toolDir = path.dirname(fileURLToPath(metaUrl))
  const desktopRoot = path.resolve(toolDir, '..', '..')

  return {
    desktopRoot,
    resourceRoot: path.join(desktopRoot, 'resources', EXTENSION_WEBVIEW_FONT_RESOURCE_DIR)
  }
}

/** Resolves the source npm package root for one configured webview font. */
export function resolveWebviewFontPackageRoot(
  context: WebviewFontToolContext,
  pkg: ExtensionWebviewFontPackage
): string {
  return path.join(context.desktopRoot, 'node_modules', ...pkg.npmPackage.split('/'))
}
