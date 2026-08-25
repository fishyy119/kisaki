/**
 * Renderer-facing asset servers for installed extensions: catalog icons,
 * packaged UI documents, and the fonts webview documents load. These serve
 * bytes over custom schemes and are independent of install mechanics.
 */

export { ExtensionIconManager } from './icon'
export { ExtensionUiAssetServer, resolveExtensionUiRootPath } from './ui'
export { ExtensionWebviewFontServer } from './fonts'
export type { ExtensionWebviewUiSource } from './ui'
