/**
 * Renderer-facing asset servers for installed extensions: catalog icons,
 * packaged UI documents, and the fonts webview documents load. These serve
 * bytes over custom schemes and are independent of install mechanics.
 */

export { ExtensionFileAssetServer, extensionFileUrl } from './files'
export { ExtensionIconServer } from './icons'
export { ExtensionUiAssetServer, resolveExtensionUiRootPath } from './ui'
export { ExtensionWebviewFontServer } from './fonts'
export type { ExtensionWebviewUiSource } from './ui'
