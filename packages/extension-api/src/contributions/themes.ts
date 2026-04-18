import type { Disposable } from '../shared'
import type { ValidationIssue } from '../shared/validation'
import {
  isPlainObject,
  prefixIssues,
  validateOptionalString,
  validateRequiredString,
  validateUnknownKeys
} from '../shared/validation'

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

export function validateThemeTokenMap(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Theme token map must be an object.' }]
  }

  const issues: ValidationIssue[] = []

  for (const tokenName of THEME_TOKEN_NAMES) {
    const tokenValue = value[tokenName]
    if (typeof tokenValue !== 'string' || tokenValue.trim().length === 0) {
      issues.push({
        path: `$.${tokenName}`,
        message: 'Theme token value must be a non-empty string.'
      })
    }
  }

  for (const tokenName of Object.keys(value)) {
    if (!isThemeTokenName(tokenName)) {
      issues.push({
        path: `$.${tokenName}`,
        message: 'Unknown theme token.'
      })
    }
  }

  return issues
}

const THEME_CONTRIBUTION_KEYS = new Set<string>(['id', 'name', 'description', 'tokens'])

const THEME_TOKENS_KEYS = new Set<string>(['light', 'dark'])

export function validateThemeContributionShape(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Theme contribution must be an object.' }]
  }

  const issues: ValidationIssue[] = [
    ...validateUnknownKeys(value, THEME_CONTRIBUTION_KEYS),
    ...validateRequiredString(value.id, '$.id', {
      trim: true,
      valueMessage: 'Theme id must be a non-empty string.'
    }),
    ...validateRequiredString(value.name, '$.name', {
      trim: true,
      valueMessage: 'Theme name must be a non-empty string.'
    }),
    ...validateOptionalString(value.description, '$.description', {
      typeMessage: 'description must be a string when provided.'
    })
  ]

  if (!isPlainObject(value.tokens)) {
    issues.push({
      path: '$.tokens',
      message: 'tokens must be an object.'
    })
    return issues
  }

  issues.push(...validateUnknownKeys(value.tokens, THEME_TOKENS_KEYS, '$.tokens'))
  issues.push(...prefixIssues('$.tokens.light', validateThemeTokenMap(value.tokens.light)))
  issues.push(...prefixIssues('$.tokens.dark', validateThemeTokenMap(value.tokens.dark)))

  return issues
}

export function isThemeContribution(value: unknown): value is ThemeContribution {
  return validateThemeContributionShape(value).length === 0
}
