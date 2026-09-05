import {
  WEBVIEW_SHADOW_TIER_NAMES,
  WEBVIEW_THEME_TOKEN_NAMES,
  type WebviewAppearance,
  type WebviewShadowMap,
  type WebviewShadowTierName,
  type WebviewTheme,
  type WebviewThemeTokenMap,
  type WebviewThemeTokenName,
  type WebviewTypography
} from '@kisaki3/extension-api'
import { extensionWebviewFontStylesheetUrls } from '@shared/extension'

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

const SHADOW_CSS_VARS: Record<WebviewShadowTierName, string> = {
  raised: '--shadow-raised',
  overlay: '--shadow-overlay',
  modal: '--shadow-modal'
}

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

  const shadows = {} as WebviewShadowMap
  for (const tier of WEBVIEW_SHADOW_TIER_NAMES) {
    shadows[tier] = styles.getPropertyValue(SHADOW_CSS_VARS[tier]).trim()
  }

  return {
    mode,
    tokens,
    shadows,
    radius: styles.getPropertyValue('--radius').trim(),
    paneAlpha: styles.getPropertyValue('--pane-alpha').trim()
  }
}

function readWebviewTypography(styles: CSSStyleDeclaration): WebviewTypography {
  return {
    stylesheets: extensionWebviewFontStylesheetUrls(),
    sans: styles.getPropertyValue('--font-sans').trim(),
    mono: styles.getPropertyValue('--font-mono').trim(),
    baseSize: styles.fontSize,
    baseWeight: styles.fontWeight,
    // Keep the unitless ratio so descendant text keeps proportional line heights.
    baseLineHeight: styles.getPropertyValue('--text-base-line-height').trim(),
    baseLetterSpacing: styles.letterSpacing
  }
}
