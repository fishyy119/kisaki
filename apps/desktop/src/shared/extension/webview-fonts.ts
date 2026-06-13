/**
 * App font delivery for the renderer and extension webview documents.
 *
 * Fonts are npm-managed Fontsource variable packages, sliced by unicode-range
 * with generated @font-face CSS. The renderer build copies each package's
 * stylesheet and slice files to `fonts/<dir>/` in the renderer output; the
 * renderer loads them relative to the document, and main serves the same
 * tree to webview documents over `kisaki-webview-font://fonts/<dir>/<path>`
 * with CORS enabled.
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
 * Document-relative stylesheet paths inside the renderer output.
 */
export function appFontStylesheetPaths(): readonly string[] {
  return EXTENSION_WEBVIEW_FONT_PACKAGES.map(
    (pkg) => `${EXTENSION_WEBVIEW_FONT_HOST}/${pkg.dir}/${pkg.stylesheet}`
  )
}

/**
 * Absolute stylesheet URLs served to webview documents.
 */
export function extensionWebviewFontStylesheetUrls(): readonly string[] {
  return EXTENSION_WEBVIEW_FONT_PACKAGES.map(
    (pkg) =>
      `${EXTENSION_WEBVIEW_FONT_SCHEME}://${EXTENSION_WEBVIEW_FONT_HOST}/${pkg.dir}/${pkg.stylesheet}`
  )
}
