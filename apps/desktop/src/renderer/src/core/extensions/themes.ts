import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { themeManager, type ThemeDefinition } from '@renderer/core/theme'
import { isSafeThemeColorToken, type ThemeContribution } from '@kisaki3/extension-api'
import type { ExtensionThemeRegistrationInfo } from '@shared/extension'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Extension')

const extensionThemeDisposers = new Map<string, () => void>()
const extensionThemeCss = new Map<string, string>()
let unsubscribe: (() => void) | null = null

export function setupExtensionThemeSync(): void {
  if (!unsubscribe) {
    unsubscribe = ipcManager.on('extension:contributions-changed', (_event, snapshot) => {
      syncExtensionThemes(snapshot.themes)
    })
  }

  void refreshExtensionThemes().catch((error) => {
    log.error('Failed to load extension themes:', error)
  })
}

export async function refreshExtensionThemes(): Promise<void> {
  syncExtensionThemes(unwrapIpcData(await ipcManager.invoke('extension:get-theme-contributions')))
}

export function syncExtensionThemes(
  contributions: readonly ExtensionThemeRegistrationInfo[]
): void {
  const nextIds = new Set<string>()

  for (const contribution of contributions) {
    const definition = toThemeDefinition(contribution)
    nextIds.add(definition.id)

    if (extensionThemeCss.get(definition.id) === definition.css) {
      continue
    }

    extensionThemeDisposers.get(definition.id)?.()
    extensionThemeDisposers.set(definition.id, themeManager.registerTheme(definition))
    extensionThemeCss.set(definition.id, definition.css)
  }

  for (const [themeId, dispose] of [...extensionThemeDisposers]) {
    if (nextIds.has(themeId)) {
      continue
    }

    dispose()
    extensionThemeDisposers.delete(themeId)
    extensionThemeCss.delete(themeId)
  }
}

function toThemeDefinition(info: ExtensionThemeRegistrationInfo): ThemeDefinition {
  const id = getExtensionThemeId(info.extensionId, info.theme.id)
  return {
    id,
    name: `${info.theme.name} (${info.extensionName})`,
    css: compileThemeCss(info.theme)
  }
}

function getExtensionThemeId(extensionId: string, themeId: string): string {
  return `extension:${extensionId}:${themeId}`
}

function compileThemeCss(theme: ThemeContribution): string {
  return [
    ':root {',
    ...compileTokenRules(theme.tokens.light, 'light'),
    '}',
    '',
    '.dark {',
    ...compileTokenRules(theme.tokens.dark, 'dark'),
    '}'
  ].join('\n')
}

/**
 * App defaults for lightbox and elevation tokens (pane alpha, shadow tiers,
 * light strength, diffuser grain). Extension themes contribute colors only;
 * these values mirror the built-in default preset.
 */
const LIGHTBOX_TOKEN_RULES: Record<'light' | 'dark', readonly string[]> = {
  light: [
    '  --pane-alpha: 72%;',
    '  --shadow-raised: 0 1px 2px 0 oklch(0.13 0.02 258 / 0.08), 0 3px 10px -2px oklch(0.13 0.02 258 / 0.1);',
    '  --shadow-overlay: inset 0 1px 0 oklch(1 0 0 / 0.5), inset 0 -1px 0 oklch(0.13 0.02 258 / 0.05), 0 1px 2px 0 oklch(0.13 0.02 258 / 0.1), 0 10px 24px -6px oklch(0.13 0.02 258 / 0.16);',
    '  --shadow-modal: inset 0 1px 0 oklch(1 0 0 / 0.55), inset 0 -1px 0 oklch(0.13 0.02 258 / 0.06), 0 2px 4px 0 oklch(0.13 0.02 258 / 0.1), 0 28px 64px -16px oklch(0.13 0.02 258 / 0.24);',
    '  --light-strength: 50%;',
    '  --grain-opacity: 9%;'
  ],
  dark: [
    '  --pane-alpha: 75%;',
    '  --shadow-raised: 0 1px 2px 0 oklch(0 0 0 / 0.35), 0 4px 12px -2px oklch(0 0 0 / 0.4);',
    '  --shadow-overlay: inset 0 1px 0 oklch(1 0 0 / 0.08), inset 0 -1px 0 oklch(0 0 0 / 0.35), 0 1px 2px 0 oklch(0 0 0 / 0.45), 0 10px 24px -6px oklch(0 0 0 / 0.5);',
    '  --shadow-modal: inset 0 1px 0 oklch(1 0 0 / 0.1), inset 0 -1px 0 oklch(0 0 0 / 0.4), 0 2px 4px 0 oklch(0 0 0 / 0.5), 0 28px 64px -16px oklch(0 0 0 / 0.65);',
    '  --light-strength: 45%;',
    '  --grain-opacity: 16%;'
  ]
}

function compileTokenRules(
  tokens: ThemeContribution['tokens']['light'],
  mode: 'light' | 'dark'
): string[] {
  const safeTokens = sanitizeThemeTokens(tokens)

  return [
    '  --radius: 6px;',
    `  --background: ${safeTokens.background};`,
    `  --foreground: ${safeTokens.foreground};`,
    `  --surface: ${safeTokens.surface};`,
    `  --surface-foreground: ${safeTokens.surfaceForeground};`,
    `  --popover: ${safeTokens.surface};`,
    `  --popover-foreground: ${safeTokens.surfaceForeground};`,
    `  --dialog: ${safeTokens.surface};`,
    `  --dialog-foreground: ${safeTokens.surfaceForeground};`,
    `  --primary: ${safeTokens.primary};`,
    `  --primary-foreground: ${safeTokens.primaryForeground};`,
    `  --secondary: ${safeTokens.muted};`,
    `  --secondary-foreground: ${safeTokens.mutedForeground};`,
    `  --muted: ${safeTokens.muted};`,
    `  --muted-foreground: ${safeTokens.mutedForeground};`,
    `  --accent: ${safeTokens.accent};`,
    `  --accent-foreground: ${safeTokens.foreground};`,
    `  --input: ${safeTokens.surface};`,
    `  --input-foreground: ${safeTokens.foreground};`,
    `  --destructive: ${safeTokens.danger};`,
    `  --destructive-foreground: ${safeTokens.primaryForeground};`,
    `  --info: ${safeTokens.primary};`,
    `  --info-foreground: ${safeTokens.primaryForeground};`,
    `  --success: ${safeTokens.primary};`,
    `  --success-foreground: ${safeTokens.primaryForeground};`,
    `  --warning: ${safeTokens.accent};`,
    `  --warning-foreground: ${safeTokens.foreground};`,
    `  --border: ${safeTokens.border};`,
    `  --ring: ${safeTokens.primary};`,
    `  --chart-1: ${safeTokens.primary};`,
    `  --chart-2: ${safeTokens.accent};`,
    `  --chart-3: ${safeTokens.muted};`,
    `  --chart-4: ${safeTokens.border};`,
    `  --chart-5: ${safeTokens.danger};`,
    ...LIGHTBOX_TOKEN_RULES[mode],
    // Ambient light colors derived from the contributed palette.
    `  --light-1: ${safeTokens.primary};`,
    `  --light-2: ${safeTokens.accent};`,
    `  --light-3: color-mix(in oklch, ${safeTokens.primary} 50%, ${safeTokens.accent});`
  ]
}

function sanitizeThemeTokens(
  tokens: ThemeContribution['tokens']['light']
): ThemeContribution['tokens']['light'] {
  const entries = Object.entries(tokens).map(([tokenName, tokenValue]) => {
    const value = tokenValue.trim()
    if (!isSafeThemeColorToken(value)) {
      throw new Error(`Extension theme token "${tokenName}" is not a safe CSS color.`)
    }

    return [tokenName, value]
  })

  return Object.fromEntries(entries) as ThemeContribution['tokens']['light']
}
