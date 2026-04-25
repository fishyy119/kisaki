import { isThemeTokenName, THEME_TOKEN_NAMES, type ThemeContribution } from './contracts'
import type { ValidationIssue } from '../../shared/validation'
import {
  isPlainObject,
  prefixIssues,
  validateOptionalString,
  validateRequiredString,
  validateUnknownKeys
} from '../../shared/validation'

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
      continue
    }

    if (!isSafeThemeColorToken(tokenValue)) {
      issues.push({
        path: `$.${tokenName}`,
        message: 'Theme token value must be a safe CSS color.'
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

export function isSafeThemeColorToken(value: string): boolean {
  const token = value.trim()
  if (token.length === 0 || token.length > 160) {
    return false
  }

  if (/[;{}\n\r]/.test(token) || token.includes('/*') || token.includes('*/')) {
    return false
  }

  if (/^#[0-9a-fA-F]{3,8}$/.test(token)) {
    return true
  }

  if (
    /^(transparent|currentColor|Canvas|CanvasText|LinkText|VisitedText|ActiveText)$/i.test(token)
  ) {
    return true
  }

  if (/^var\(--[A-Za-z0-9_-]+\)$/.test(token)) {
    return true
  }

  const fnMatch = token.match(/^([a-zA-Z-]+)\((.*)\)$/)
  if (!fnMatch) {
    return false
  }

  const fnName = fnMatch[1].toLowerCase()
  if (
    ![
      'rgb',
      'rgba',
      'hsl',
      'hsla',
      'hwb',
      'lab',
      'lch',
      'oklab',
      'oklch',
      'color',
      'color-mix'
    ].includes(fnName)
  ) {
    return false
  }

  return /^[#A-Za-z0-9\s.,%+\-/()_]+$/.test(fnMatch[2]) && !/\burl\s*\(/i.test(fnMatch[2])
}
