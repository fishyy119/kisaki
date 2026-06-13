import { appFontStylesheetPaths } from '@shared/extension'

/**
 * Loads the app font stylesheets (Fontsource packages copied to `fonts/` in
 * the renderer output, served by the dev server in development). Runtime
 * injection keeps the unicode-range sliced files out of the bundler asset
 * graph, so the same stable tree is also served to extension webviews.
 */
export function loadAppFonts(): void {
  const head = document.head
  for (const path of appFontStylesheetPaths()) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = new URL(path, document.baseURI).toString()
    head.appendChild(link)
  }
}
