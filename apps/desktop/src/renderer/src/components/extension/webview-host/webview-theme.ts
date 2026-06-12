import { THEME_TOKEN_NAMES, type ThemeTokenMap, type WebviewTheme } from '@kisaki3/extension-api'

const TOKEN_CSS_VARS: Record<(typeof THEME_TOKEN_NAMES)[number], string> = {
  background: '--background',
  foreground: '--foreground',
  surface: '--surface',
  surfaceForeground: '--surface-foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  border: '--border',
  accent: '--accent',
  danger: '--destructive'
}

/**
 * Reads the active semantic theme tokens from the document so webview
 * documents render with the same resolved palette as the app.
 */
export function readCurrentWebviewTheme(mode: 'light' | 'dark'): WebviewTheme {
  const styles = getComputedStyle(document.documentElement)
  const tokens = {} as Record<keyof ThemeTokenMap, string>

  for (const tokenName of THEME_TOKEN_NAMES) {
    tokens[tokenName] = styles.getPropertyValue(TOKEN_CSS_VARS[tokenName]).trim()
  }

  return { mode, tokens }
}
