import { ipcManager } from '@renderer/core/ipc'
import { themeManager, type ThemeDefinition } from '@renderer/core/theme'
import { getExtensionThemeContributions } from './ipc'
import type { ThemeContribution } from '@kisaki/extension-api'
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
  return [
    '  --radius: 6px;',
    `  --background: ${tokens.background};`,
    `  --foreground: ${tokens.foreground};`,
    `  --surface: ${tokens.surface};`,
    `  --surface-foreground: ${tokens.surfaceForeground};`,
    `  --card: ${tokens.surface};`,
    `  --card-foreground: ${tokens.surfaceForeground};`,
    `  --popover: ${tokens.surface};`,
    `  --popover-foreground: ${tokens.surfaceForeground};`,
    `  --dialog: ${tokens.surface};`,
    `  --dialog-foreground: ${tokens.surfaceForeground};`,
    `  --primary: ${tokens.primary};`,
    `  --primary-foreground: ${tokens.primaryForeground};`,
    `  --secondary: ${tokens.muted};`,
    `  --secondary-foreground: ${tokens.mutedForeground};`,
    `  --muted: ${tokens.muted};`,
    `  --muted-foreground: ${tokens.mutedForeground};`,
    `  --accent: ${tokens.accent};`,
    `  --accent-foreground: ${tokens.foreground};`,
    `  --input: ${tokens.surface};`,
    `  --input-foreground: ${tokens.foreground};`,
    `  --destructive: ${tokens.danger};`,
    `  --destructive-foreground: ${tokens.primaryForeground};`,
    `  --info: ${tokens.primary};`,
    `  --info-foreground: ${tokens.primaryForeground};`,
    `  --success: ${tokens.primary};`,
    `  --success-foreground: ${tokens.primaryForeground};`,
    `  --warning: ${tokens.accent};`,
    `  --warning-foreground: ${tokens.foreground};`,
    `  --border: ${tokens.border};`,
    `  --ring: ${tokens.primary};`,
    `  --chart-1: ${tokens.primary};`,
    `  --chart-2: ${tokens.accent};`,
    `  --chart-3: ${tokens.muted};`,
    `  --chart-4: ${tokens.border};`,
    `  --chart-5: ${tokens.danger};`
  ]
}
