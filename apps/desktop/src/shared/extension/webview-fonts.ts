/**
 * App fonts for extension webview documents.
 *
 * Fonts are npm-managed Fontsource variable packages, sliced by unicode-range
 * with generated @font-face CSS. The app renderer loads them through its own
 * CSS pipeline (a plain `@import` in globals.css). For webviews, the renderer
 * build also copies each package's stylesheet and slice files to `fonts/<dir>/`
 * in the renderer output, and main serves that tree to webview documents over
 * `kisaki-webview-font://fonts/<dir>/<path>` with CORS enabled.
 */

export const EXTENSION_WEBVIEW_FONT_SCHEME = 'kisaki-webview-font'

export const EXTENSION_WEBVIEW_FONT_HOST = 'fonts'

export interface ExtensionWebviewFontPackage {
  /**
   * Directory name under the served font root; also the renderer output
   * directory under `fonts/`.
   */
  dir: string
  /**
   * Source npm package; main resolves dev-mode files from it directly.
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

export const EXTENSION_WEBVIEW_FONT_SANS_STACK =
  "'Noto Sans SC Variable', ui-sans-serif, system-ui, sans-serif"

/**
 * CJK glyphs in mono contexts intentionally fall back to the sans family;
 * the mono face covers latin/greek/cyrillic.
 */
export const EXTENSION_WEBVIEW_FONT_MONO_STACK =
  "'Noto Sans Mono Variable', 'Noto Sans SC Variable', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

/**
 * Absolute stylesheet URLs served to webview documents.
 */
export function extensionWebviewFontStylesheetUrls(): readonly string[] {
  return EXTENSION_WEBVIEW_FONT_PACKAGES.map(
    (pkg) =>
      `${EXTENSION_WEBVIEW_FONT_SCHEME}://${EXTENSION_WEBVIEW_FONT_HOST}/${pkg.dir}/${pkg.stylesheet}`
  )
}
