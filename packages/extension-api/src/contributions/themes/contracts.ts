import type { Disposable } from '../../shared'

export const THEME_TOKEN_NAMES = [
  'background',
  'foreground',
  'surface',
  'surfaceForeground',
  'primary',
  'primaryForeground',
  'muted',
  'mutedForeground',
  'border',
  'accent',
  'danger'
] as const

export type ThemeTokenName = (typeof THEME_TOKEN_NAMES)[number]

export type ThemeTokenMap = Record<ThemeTokenName, string>

export interface ThemeContribution {
  id: string
  name: string
  description?: string
  tokens: {
    light: ThemeTokenMap
    dark: ThemeTokenMap
  }
}

export interface ThemeRegistrar {
  register(theme: ThemeContribution): Disposable
}

export function isThemeTokenName(value: string): value is ThemeTokenName {
  return (THEME_TOKEN_NAMES as readonly string[]).includes(value)
}
