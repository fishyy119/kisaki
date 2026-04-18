import type { ValidationIssue } from './shared/validation'
import {
  isPlainObject,
  validateOptionalString,
  validateRequiredArray,
  validateRequiredString,
  validateUnknownKeys
} from './shared/validation'

export const EXTENSION_CATEGORIES = ['scraper', 'tool', 'theme', 'integration'] as const

export type ExtensionCategory = (typeof EXTENSION_CATEGORIES)[number]

export interface ExtensionManifestEngines {
  kisaki?: string
}

export interface ExtensionManifest {
  $schema?: string
  id: string
  name: string
  version: string
  categories: readonly ExtensionCategory[]
  entry: string
  description?: string
  author?: string
  homepage?: string
  icon?: string
  keywords?: readonly string[]
  engines?: ExtensionManifestEngines
}

const MANIFEST_KEYS = new Set<string>([
  '$schema',
  'id',
  'name',
  'version',
  'entry',
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
    ...validateRequiredString(value.id, '$.id', {
      minLength: 1,
      valueMessage: 'Field must be a non-empty string.'
    }),
    ...validateRequiredString(value.name, '$.name', {
      minLength: 1,
      valueMessage: 'Field must be a non-empty string.'
    }),
    ...validateRequiredString(value.version, '$.version', {
      minLength: 1,
      valueMessage: 'Field must be a non-empty string.'
    }),
    ...validateRequiredString(value.entry, '$.entry', {
      minLength: 1,
      valueMessage: 'Field must be a non-empty string.'
    }),
    ...validateOptionalString(value.description, '$.description', {
      typeMessage: 'Field must be a string when provided.'
    }),
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
  if (engines !== undefined) {
    if (!isPlainObject(engines)) {
      issues.push({
        path: '$.engines',
        message: 'Engines must be an object.'
      })
    } else {
      for (const key of Object.keys(engines)) {
        if (key !== 'kisaki') {
          issues.push({
            path: `$.engines.${key}`,
            message: 'Unknown engines field.'
          })
        }
      }

      issues.push(
        ...validateOptionalString(engines.kisaki, '$.engines.kisaki', {
          minLength: 1,
          typeMessage: 'engines.kisaki must be a string when provided.',
          valueMessage: 'engines.kisaki must be a non-empty string when provided.'
        })
      )
    }
  }

  return issues
}

export function isExtensionManifest(value: unknown): value is ExtensionManifest {
  return validateExtensionManifestShape(value).length === 0
}
