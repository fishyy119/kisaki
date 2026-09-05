/**
 * App fonts for extension webview documents.
 *
 * Fonts are npm-managed Fontsource variable packages, sliced by unicode-range
 * with generated @font-face CSS. The app renderer loads them through its own
 * CSS pipeline (a plain `@import` in globals.css). For webviews, the desktop
 * resource build writes a stable `resources/webview-fonts/<dir>/` tree, and
 * main serves that tree to webview documents over
 * `kisaki-webview-font://fonts/<dir>/<path>` with CORS enabled.
 */

export const EXTENSION_WEBVIEW_FONT_SCHEME = 'kisaki-webview-font'

export const EXTENSION_WEBVIEW_FONT_HOST = 'fonts'

export const EXTENSION_WEBVIEW_FONT_RESOURCE_DIR = 'webview-fonts'

export interface ExtensionWebviewFontPackage {
  /**
   * Directory name under the served font root and resources/webview-fonts.
   */
  dir: string
  /**
   * Source npm package copied into the desktop webview font resource tree.
   */
  npmPackage: string
  /**
   * Entry stylesheet inside the package (slice files sit next to it).
   */
  stylesheet: string
}

export const EXTENSION_WEBVIEW_FONT_PACKAGES: readonly ExtensionWebviewFontPackage[] = [
  {
    dir: 'noto-sans-sc',
    npmPackage: '@fontsource-variable/noto-sans-sc',
    stylesheet: 'index.css'
  },
  {
    dir: 'noto-sans-mono',
    npmPackage: '@fontsource-variable/noto-sans-mono',
    stylesheet: 'index.css'
  }
]

/**
 * Absolute stylesheet URLs served to webview documents.
 */
export function extensionWebviewFontStylesheetUrls(): readonly string[] {
  return EXTENSION_WEBVIEW_FONT_PACKAGES.map(
    (pkg) =>
      `${EXTENSION_WEBVIEW_FONT_SCHEME}://${EXTENSION_WEBVIEW_FONT_HOST}/${pkg.dir}/${pkg.stylesheet}`
  )
}
