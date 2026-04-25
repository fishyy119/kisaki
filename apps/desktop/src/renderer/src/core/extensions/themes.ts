import { ipcManager } from '@renderer/core/ipc'
import { themeManager, type ThemeDefinition } from '@renderer/core/theme'
import { getExtensionThemeContributions } from './ipc'
import { isSafeThemeColorToken, type ThemeContribution } from '@kisaki/extension-api'
import type { ExtensionThemeContributionInfo } from './types'

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
    console.error('[ExtensionThemes] Failed to load extension themes:', error)
  })
}

export async function refreshExtensionThemes(): Promise<void> {
  syncExtensionThemes(await getExtensionThemeContributions())
}

export function syncExtensionThemes(
  contributions: readonly ExtensionThemeContributionInfo[]
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

function toThemeDefinition(info: ExtensionThemeContributionInfo): ThemeDefinition {
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
    ...compileTokenRules(theme.tokens.light),
    '}',
    '',
    '.dark {',
    ...compileTokenRules(theme.tokens.dark),
    '}'
  ].join('\n')
}

function compileTokenRules(tokens: ThemeContribution['tokens']['light']): string[] {
  const safeTokens = sanitizeThemeTokens(tokens)

  return [
    '  --radius: 6px;',
    `  --background: ${safeTokens.background};`,
    `  --foreground: ${safeTokens.foreground};`,
    `  --surface: ${safeTokens.surface};`,
    `  --surface-foreground: ${safeTokens.surfaceForeground};`,
    `  --card: ${safeTokens.surface};`,
    `  --card-foreground: ${safeTokens.surfaceForeground};`,
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
    `  --chart-5: ${safeTokens.danger};`
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
