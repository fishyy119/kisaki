import type { ExtensionContext } from '@kisaki3/extension-sdk'

const themeName = `__EXTENSION_NAME__`

/** Registers a light and dark semantic-token theme. */
export function activateStarter(context: ExtensionContext): void {
  context.contributions.themes.register({
    id: 'default',
    name: themeName,
    description: 'A Kisaki theme.',
    tokens: {
      light: {
        background: '#f8fafc',
        foreground: '#111827',
        surface: '#ffffff',
        surfaceForeground: '#1f2937',
        primary: '#2563eb',
        primaryForeground: '#ffffff',
        muted: '#e5e7eb',
        mutedForeground: '#6b7280',
        border: '#cbd5e1',
        accent: '#14b8a6',
        danger: '#dc2626'
      },
      dark: {
        background: '#0f172a',
        foreground: '#f8fafc',
        surface: '#111827',
        surfaceForeground: '#e5e7eb',
        primary: '#60a5fa',
        primaryForeground: '#0f172a',
        muted: '#1f2937',
        mutedForeground: '#94a3b8',
        border: '#334155',
        accent: '#2dd4bf',
        danger: '#f87171'
      }
    }
  })
}
