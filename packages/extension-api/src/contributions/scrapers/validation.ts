import {
  CHARACTER_SCRAPER_SLOTS,
  COMPANY_SCRAPER_SLOTS,
  GAME_SCRAPER_SLOTS,
  PERSON_SCRAPER_SLOTS
} from './contracts'
import type { ValidationIssue } from '../../shared/validation'
import {
  isPlainObject,
  validateRequiredArray,
  validateRequiredFunction,
  validateRequiredString,
  validateUnknownKeys
} from '../../shared/validation'

const SCRAPER_PROVIDER_KEYS = new Set<string>([
  'id',
  'name',
  'capabilities',
  'search',
  'resolve',
  'openSession'
])

function validateScraperProviderShape(
  value: unknown,
  allowedSlots: readonly string[],
  providerLabel: string
): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: `${providerLabel} must be an object.` }]
  }

  const issues: ValidationIssue[] = [
    ...validateUnknownKeys(value, SCRAPER_PROVIDER_KEYS),
    ...validateRequiredString(value.id, '$.id', {
      trim: true,
      valueMessage: 'Provider id must be a non-empty string.'
    }),
    ...validateRequiredString(value.name, '$.name', {
      trim: true,
      valueMessage: 'Provider name must be a non-empty string.'
    }),
    ...validateRequiredFunction(value.search, '$.search').map((issue) => ({
      ...issue,
      message: 'search must be a function.'
    })),
    ...validateRequiredFunction(value.resolve, '$.resolve').map((issue) => ({
      ...issue,
      message: 'resolve must be a function.'
    })),
    ...validateRequiredFunction(value.openSession, '$.openSession').map((issue) => ({
      ...issue,
      message: 'openSession must be a function.'
    }))
  ]

  issues.push(
    ...validateRequiredArray(value.capabilities, '$.capabilities', {
      minLength: 1,
      typeMessage: 'capabilities must be an array.',
      valueMessage: 'capabilities must contain at least one item.'
    })
  )

  if (Array.isArray(value.capabilities)) {
    const seen = new Set<string>()
    const allowedCapabilities = new Set<string>(['search', ...allowedSlots])

    for (const [index, capability] of value.capabilities.entries()) {
      if (typeof capability !== 'string' || !allowedCapabilities.has(capability)) {
        issues.push({
          path: `$.capabilities[${index}]`,
          message: 'Capability must be search or one of the media-specific scraper slots.'
        })
        continue
      }

      if (seen.has(capability)) {
        issues.push({
          path: `$.capabilities[${index}]`,
          message: 'Duplicate scraper capabilities are not allowed.'
        })
      }
      seen.add(capability)
    }
  }

  return issues
}

export function validateGameScraperProviderShape(value: unknown): ValidationIssue[] {
  return validateScraperProviderShape(value, GAME_SCRAPER_SLOTS, 'Game scraper provider')
}

export function validatePersonScraperProviderShape(value: unknown): ValidationIssue[] {
  return validateScraperProviderShape(value, PERSON_SCRAPER_SLOTS, 'Person scraper provider')
}

export function validateCompanyScraperProviderShape(value: unknown): ValidationIssue[] {
  return validateScraperProviderShape(value, COMPANY_SCRAPER_SLOTS, 'Company scraper provider')
}

export function validateCharacterScraperProviderShape(value: unknown): ValidationIssue[] {
  return validateScraperProviderShape(value, CHARACTER_SCRAPER_SLOTS, 'Character scraper provider')
}
