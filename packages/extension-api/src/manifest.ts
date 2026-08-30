import type { ValidationIssue } from './shared/validation'
import { validateExtensionIdentifier } from './shared/extension-id'
import {
  isPlainObject,
  validateOptionalString,
  validateRequiredArray,
  validateRequiredString,
  validateUnknownKeys
} from './shared/validation'
import {
  validateLocalizedTextShape,
  validateOptionalLocalizedTextShape,
  type LocalizedText
} from './shared/locales'
import semver from 'semver'

export const EXTENSION_CATEGORIES = ['scraper', 'tool', 'theme', 'integration'] as const

export type ExtensionCategory = (typeof EXTENSION_CATEGORIES)[number]

export const EXTENSION_ENTRY_FILE_EXTENSIONS = ['.mjs'] as const

export type ExtensionEntryFileExtension = (typeof EXTENSION_ENTRY_FILE_EXTENSIONS)[number]

export interface ExtensionManifestEngines {
  kisakiExtensionApi: string
}

export interface ExtensionManifest {
  $schema?: string
  id: string
  name: LocalizedText
  version: string
  categories: readonly ExtensionCategory[]
  entry: string
  /**
   * Package-relative root directory of built webview UI assets, e.g.
   * `./dist/ui`. Required for the extension to open webviews.
   */
  ui?: string | undefined
  description?: LocalizedText | undefined
  author?: string | undefined
  homepage?: string | undefined
  icon?: string | undefined
  keywords?: readonly string[] | undefined
  engines: ExtensionManifestEngines
}

export interface ParsedExtensionManifest {
  manifest: ExtensionManifest | null
  issues: ValidationIssue[]
}

const MANIFEST_KEYS = new Set<string>([
  '$schema',
  'id',
  'name',
  'version',
  'entry',
  'ui',
  'description',
  'author',
  'homepage',
  'icon',
  'categories',
  'keywords',
  'engines'
])

export function isExtensionCategory(value: unknown): value is ExtensionCategory {
  return typeof value === 'string' && (EXTENSION_CATEGORIES as readonly string[]).includes(value)
}

export function validateExtensionManifestShape(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Manifest must be a JSON object.' }]
  }

  issues.push(
    ...validateUnknownKeys(value, MANIFEST_KEYS).map((issue) => ({
      ...issue,
      message: 'Unknown manifest field.'
    }))
  )

  issues.push(
    ...validateOptionalString(value.$schema, '$.$schema', {
      typeMessage: 'Field must be a string when provided.'
    }),
    ...validateExtensionIdentifier(value.id, '$.id'),
    ...validateLocalizedTextShape(value.name, '$.name'),
    ...validateRequiredString(value.version, '$.version', {
      minLength: 1,
      valueMessage: 'Field must be a non-empty string.'
    }),
    ...validateRequiredString(value.entry, '$.entry', {
      minLength: 1,
      valueMessage: 'Field must be a non-empty string.'
    }),
    ...validateOptionalString(value.ui, '$.ui', {
      minLength: 1,
      typeMessage: 'Field must be a string when provided.',
      valueMessage: 'Field must be a non-empty string when provided.'
    }),
    ...validateOptionalLocalizedTextShape(value.description, '$.description'),
    ...validateOptionalString(value.author, '$.author', {
      typeMessage: 'Field must be a string when provided.'
    }),
    ...validateOptionalString(value.homepage, '$.homepage', {
      typeMessage: 'Field must be a string when provided.'
    }),
    ...validateOptionalString(value.icon, '$.icon', {
      minLength: 1,
      typeMessage: 'Field must be a string when provided.',
      valueMessage: 'Field must be a non-empty string when provided.'
    })
  )

  if (typeof value.homepage === 'string') {
    try {
      void new URL(value.homepage)
    } catch {
      issues.push({
        path: '$.homepage',
        message: 'homepage must be a valid URI.'
      })
    }
  }

  const categories = value.categories
  issues.push(
    ...validateRequiredArray(categories, '$.categories', {
      minLength: 1,
      typeMessage: 'Categories must be an array.',
      valueMessage: 'Categories must contain at least one item.'
    })
  )
  if (Array.isArray(categories)) {
    const seen = new Set<string>()
    for (const [index, category] of categories.entries()) {
      if (!isExtensionCategory(category)) {
        issues.push({
          path: `$.categories[${index}]`,
          message: 'Category must be one of the official extension categories.'
        })
      }

      if (typeof category === 'string') {
        if (seen.has(category)) {
          issues.push({
            path: `$.categories[${index}]`,
            message: 'Duplicate category values are not allowed.'
          })
        }
        seen.add(category)
      }
    }
  }

  const keywords = value.keywords
  if (keywords !== undefined) {
    if (!Array.isArray(keywords)) {
      issues.push({
        path: '$.keywords',
        message: 'Keywords must be an array of strings.'
      })
    } else {
      const seen = new Set<string>()
      for (const [index, keyword] of keywords.entries()) {
        if (typeof keyword !== 'string' || keyword.length === 0) {
          issues.push({
            path: `$.keywords[${index}]`,
            message: 'Keyword must be a non-empty string.'
          })
          continue
        }

        if (seen.has(keyword)) {
          issues.push({
            path: `$.keywords[${index}]`,
            message: 'Duplicate keyword values are not allowed.'
          })
        }
        seen.add(keyword)
      }
    }
  }

  const engines = value.engines
  if (engines === undefined) {
    issues.push({
      path: '$.engines.kisakiExtensionApi',
      message:
        'engines.kisakiExtensionApi is required and must declare an Extension API version range.'
    })
  } else if (!isPlainObject(engines)) {
    issues.push({
      path: '$.engines',
      message: 'engines must declare the extension API compatibility range.'
    })
  } else {
    for (const key of Object.keys(engines)) {
      if (key !== 'kisakiExtensionApi') {
        issues.push({
          path: `$.engines.${key}`,
          message: 'Unknown engines field.'
        })
      }
    }

    issues.push(
      ...validateRequiredString(engines.kisakiExtensionApi, '$.engines.kisakiExtensionApi', {
        minLength: 1,
        typeMessage: 'engines.kisakiExtensionApi must be a string.',
        valueMessage: 'engines.kisakiExtensionApi must be a non-empty Extension API range.'
      })
    )
  }

  return issues
}

export function isExtensionManifest(value: unknown): value is ExtensionManifest {
  return validateExtensionManifestShape(value).length === 0
}

export function parseExtensionManifest(value: unknown): ParsedExtensionManifest {
  const issues = [...validateExtensionManifestShape(value)]

  if (issues.length > 0) {
    return { manifest: null, issues }
  }

  const manifest = value as ExtensionManifest
  issues.push(...validateExtensionManifestSemver(manifest))

  const normalizedEntry = normalizeExtensionPackagePath(manifest.entry)
  if (!normalizedEntry) {
    issues.push({
      path: '$.entry',
      message: 'Path must be relative and stay inside the extension package root.'
    })
  } else if (!hasExtensionEntryFileExtension(normalizedEntry)) {
    issues.push({
      path: '$.entry',
      message: 'Entry must point to a .mjs file.'
    })
  }

  const normalizedUi =
    manifest.ui === undefined ? undefined : normalizeExtensionPackagePath(manifest.ui)
  if (manifest.ui !== undefined && !normalizedUi) {
    issues.push({
      path: '$.ui',
      message: 'Path must be relative and stay inside the extension package root.'
    })
  }

  const normalizedIcon =
    manifest.icon === undefined ? undefined : normalizeExtensionPackagePath(manifest.icon)
  if (manifest.icon !== undefined && !normalizedIcon) {
    issues.push({
      path: '$.icon',
      message: 'Path must be relative and stay inside the extension package root.'
    })
  }

  if (issues.length > 0 || !normalizedEntry) {
    return { manifest: null, issues }
  }

  const { ui: _ui, icon: _icon, ...manifestWithoutOptionalPaths } = manifest
  const normalizedManifest: ExtensionManifest = {
    ...manifestWithoutOptionalPaths,
    entry: normalizedEntry
  }

  if (normalizedUi !== undefined && normalizedUi !== null) {
    normalizedManifest.ui = normalizedUi
  }

  if (normalizedIcon !== undefined && normalizedIcon !== null) {
    normalizedManifest.icon = normalizedIcon
  }

  return {
    manifest: normalizedManifest,
    issues
  }
}

export function hasExtensionEntryFileExtension(value: string): boolean {
  return EXTENSION_ENTRY_FILE_EXTENSIONS.some((extension) => value.endsWith(extension))
}

export function validateExtensionManifestSemver(
  manifest: Pick<ExtensionManifest, 'version' | 'engines'>
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!semver.valid(manifest.version)) {
    issues.push({
      path: '$.version',
      message: 'version must be a valid semver string.'
    })
  }

  if (!semver.validRange(manifest.engines.kisakiExtensionApi)) {
    issues.push({
      path: '$.engines.kisakiExtensionApi',
      message: 'engines.kisakiExtensionApi must be a valid Extension API semver range.'
    })
  }

  return issues
}

export function normalizeExtensionPackagePath(value: string): string | null {
  if (/^[A-Za-z]:[\\/]/.test(value)) {
    return null
  }

  const parts: string[] = []
  for (const part of value.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') {
      continue
    }

    if (part === '..') {
      return null
    }

    parts.push(part)
  }

  if (parts.length === 0 || value.replace(/\\/g, '/').startsWith('/')) {
    return null
  }

  return parts.join('/')
}
