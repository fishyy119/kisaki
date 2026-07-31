import {
  WEBVIEW_THEME_TOKEN_NAMES,
  type WebviewAppearance,
  type WebviewTheme,
  type WebviewThemeTokenMap,
  type WebviewThemeTokenName,
  type WebviewTypography
} from '@kisaki3/extension-api'
import {
  EXTENSION_WEBVIEW_FONT_MONO_STACK,
  EXTENSION_WEBVIEW_FONT_SANS_STACK,
  extensionWebviewFontStylesheetUrls
} from '@shared/extension'

const TOKEN_CSS_VARS: Record<WebviewThemeTokenName, string> = {
  background: '--background',
  foreground: '--foreground',
  surface: '--surface',
  surfaceForeground: '--surface-foreground',
  popover: '--popover',
  popoverForeground: '--popover-foreground',
  dialog: '--dialog',
  dialogForeground: '--dialog-foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  input: '--input',
  inputForeground: '--input-foreground',
  destructive: '--destructive',
  destructiveForeground: '--destructive-foreground',
  info: '--info',
  infoForeground: '--info-foreground',
  success: '--success',
  successForeground: '--success-foreground',
  warning: '--warning',
  warningForeground: '--warning-foreground',
  border: '--border',
  ring: '--ring'
}

const DEFAULT_RADIUS = '6px'

const TYPOGRAPHY_DEFAULTS = {
  baseSize: '14px',
  baseWeight: '450',
  baseLineHeight: '1.5',
  baseLetterSpacing: 'normal'
} as const

/**
 * Reads the full resolved appearance (theme + typography) from the document
 * so webview documents render with the same palette, radius, fonts, and base
 * metrics as the app. Reading live values means a future appearance setting
 * flows to extensions with no bridge changes.
 */
export function readCurrentWebviewAppearance(mode: 'light' | 'dark'): WebviewAppearance {
  const styles = getComputedStyle(document.documentElement)
  return {
    theme: readWebviewTheme(styles, mode),
    typography: readWebviewTypography(styles)
  }
}

function readWebviewTheme(styles: CSSStyleDeclaration, mode: 'light' | 'dark'): WebviewTheme {
  const tokens = {} as WebviewThemeTokenMap
  for (const tokenName of WEBVIEW_THEME_TOKEN_NAMES) {
    tokens[tokenName] = styles.getPropertyValue(TOKEN_CSS_VARS[tokenName]).trim()
  }

  return {
    mode,
    tokens,
    radius: styles.getPropertyValue('--radius').trim() || DEFAULT_RADIUS,
    // The lightbox glass alpha; the opaque fallback keeps documents readable
    // if a theme ever drops the token.
    paneAlpha: styles.getPropertyValue('--pane-alpha').trim() || '100%'
  }
}

function readWebviewTypography(styles: CSSStyleDeclaration): WebviewTypography {
  return {
    stylesheets: extensionWebviewFontStylesheetUrls(),
    sans: styles.getPropertyValue('--font-sans').trim() || EXTENSION_WEBVIEW_FONT_SANS_STACK,
    mono: styles.getPropertyValue('--font-mono').trim() || EXTENSION_WEBVIEW_FONT_MONO_STACK,
    baseSize: styles.getPropertyValue('--text-base-size').trim() || TYPOGRAPHY_DEFAULTS.baseSize,
    baseWeight:
      styles.getPropertyValue('--text-base-weight').trim() || TYPOGRAPHY_DEFAULTS.baseWeight,
    baseLineHeight:
      styles.getPropertyValue('--text-base-line-height').trim() ||
      TYPOGRAPHY_DEFAULTS.baseLineHeight,
    baseLetterSpacing:
      styles.getPropertyValue('--text-base-letter-spacing').trim() ||
      TYPOGRAPHY_DEFAULTS.baseLetterSpacing
  }
}
