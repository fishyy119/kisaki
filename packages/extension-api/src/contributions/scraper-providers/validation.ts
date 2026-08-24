import {
  ANIME_SCRAPER_SLOTS,
  CHARACTER_SCRAPER_SLOTS,
  COMPANY_SCRAPER_SLOTS,
  GAME_SCRAPER_SLOTS,
  PERSON_SCRAPER_SLOTS,
  type AnimeScraperSlot,
  type CharacterScraperSlot,
  type CompanyScraperSlot,
  type GameScraperSlot,
  type PersonScraperSlot
} from './contracts'
import {
  LIBRARY_ANIME_CHARACTER_ROLES,
  LIBRARY_ANIME_COMPANY_ROLES,
  LIBRARY_ANIME_EPISODE_TYPES,
  LIBRARY_ANIME_FORMATS,
  LIBRARY_ANIME_PERSON_ROLES,
  LIBRARY_BLOOD_TYPES,
  LIBRARY_CHARACTER_PERSON_ROLES,
  LIBRARY_CUP_SIZES,
  LIBRARY_GAME_CHARACTER_ROLES,
  LIBRARY_GAME_COMPANY_ROLES,
  LIBRARY_GAME_PERSON_ROLES,
  LIBRARY_GENDERS,
  LIBRARY_MEDIA_RELATION_TYPES
} from '../../shared/library'
import { LIBRARY_MEDIA_TYPES } from '../../capabilities/library/graph'
import type { ValidationIssue } from '../../shared/validation'
import {
  isPlainObject,
  validateOptionalBoolean,
  validateOptionalEnumString,
  validateOptionalFiniteNumber,
  validateOptionalString,
  validateRequiredArray,
  validateRequiredEnumString,
  validateRequiredFiniteNumber,
  validateRequiredFunction,
  validateRequiredString,
  validateUnknownKeys
} from '../../shared/validation'

const RESOLVED_TARGET_KEYS = new Set<string>(['cacheKey', 'resolveName', 'id', 'identity'])
const SESSION_RESULT_KEYS = new Set<string>(['identity', 'slots'])
const EXTERNAL_ID_KEYS = new Set<string>(['source', 'id'])
const SCRAPED_IDENTITY_KEYS = new Set<string>(['externalIds'])
const RELATED_SITE_KEYS = new Set<string>(['label', 'url'])
const PARTIAL_DATE_KEYS = new Set<string>(['year', 'month', 'day'])
const SCRAPED_TAG_KEYS = new Set<string>(['name', 'isSpoiler', 'note', 'isNsfw'])
const GAME_SEARCH_RESULT_KEYS = new Set<string>([
  'id',
  'name',
  'originalName',
  'releaseDate',
  'externalIds'
])
const ANIME_SEARCH_RESULT_KEYS = new Set<string>([
  'id',
  'name',
  'originalName',
  'releaseDate',
  'format',
  'externalIds'
])
const PERSON_SEARCH_RESULT_KEYS = new Set<string>([
  'id',
  'name',
  'originalName',
  'birthDate',
  'deathDate',
  'externalIds'
])
const COMPANY_SEARCH_RESULT_KEYS = new Set<string>([
  'id',
  'name',
  'originalName',
  'foundedDate',
  'externalIds'
])
const CHARACTER_SEARCH_RESULT_KEYS = new Set<string>([
  'id',
  'name',
  'originalName',
  'birthDate',
  'externalIds'
])
const GAME_INFO_KEYS = new Set<string>([
  'name',
  'originalName',
  'aliases',
  'releaseDate',
  'description',
  'externalSites'
])
const ANIME_INFO_KEYS = new Set<string>([
  'name',
  'originalName',
  'aliases',
  'releaseDate',
  'description',
  'format',
  'totalEpisodes',
  'externalSites'
])
const ANIME_EPISODE_KEYS = new Set<string>([
  'number',
  'type',
  'name',
  'originalName',
  'airDate',
  'description',
  'durationMs',
  'externalIds'
])
const PERSON_INFO_KEYS = new Set<string>([
  'name',
  'originalName',
  'aliases',
  'birthDate',
  'deathDate',
  'gender',
  'description',
  'externalSites'
])
const PERSON_METADATA_KEYS = new Set<string>([...PERSON_INFO_KEYS, 'identity', 'tags', 'photos'])
const COMPANY_INFO_KEYS = new Set<string>([
  'name',
  'originalName',
  'foundedDate',
  'description',
  'externalSites'
])
const COMPANY_METADATA_KEYS = new Set<string>([...COMPANY_INFO_KEYS, 'identity', 'tags', 'logos'])
const CHARACTER_INFO_KEYS = new Set<string>([
  'name',
  'originalName',
  'aliases',
  'birthDate',
  'gender',
  'age',
  'bloodType',
  'height',
  'weight',
  'bust',
  'waist',
  'hips',
  'cup',
  'description',
  'externalSites'
])
const CHARACTER_REFERENCE_KEYS = new Set<string>([...CHARACTER_INFO_KEYS, 'identity'])
const CHARACTER_METADATA_KEYS = new Set<string>([
  ...CHARACTER_INFO_KEYS,
  'identity',
  'tags',
  'persons',
  'photos'
])
const GAME_PERSON_FACT_KEYS = new Set<string>([
  ...PERSON_METADATA_KEYS,
  'role',
  'isSpoiler',
  'note'
])
const GAME_COMPANY_FACT_KEYS = new Set<string>([
  ...COMPANY_METADATA_KEYS,
  'role',
  'isSpoiler',
  'note'
])
const GAME_CHARACTER_FACT_KEYS = new Set<string>([
  ...CHARACTER_METADATA_KEYS,
  'role',
  'isSpoiler',
  'note'
])
const ANIME_PERSON_FACT_KEYS = GAME_PERSON_FACT_KEYS
const ANIME_COMPANY_FACT_KEYS = GAME_COMPANY_FACT_KEYS
const ANIME_CHARACTER_FACT_KEYS = GAME_CHARACTER_FACT_KEYS
const CHARACTER_PERSON_FACT_KEYS = new Set<string>([
  ...PERSON_METADATA_KEYS,
  'character',
  'role',
  'isSpoiler',
  'note'
])
const RELATED_ENTRY_FACT_KEYS = new Set<string>([
  'mediaType',
  'source',
  'externalId',
  'type',
  'note'
])
const GAME_SESSION_KEYS: ReadonlySet<GameScraperSlot> = new Set(GAME_SCRAPER_SLOTS)
const ANIME_SESSION_KEYS: ReadonlySet<AnimeScraperSlot> = new Set(ANIME_SCRAPER_SLOTS)
const PERSON_SESSION_KEYS: ReadonlySet<PersonScraperSlot> = new Set(PERSON_SCRAPER_SLOTS)
const COMPANY_SESSION_KEYS: ReadonlySet<CompanyScraperSlot> = new Set(COMPANY_SCRAPER_SLOTS)
const CHARACTER_SESSION_KEYS: ReadonlySet<CharacterScraperSlot> = new Set(CHARACTER_SCRAPER_SLOTS)

function validateScraperProviderShape(
  value: unknown,
  allowedSlots: readonly string[],
  providerLabel: string
): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: `${providerLabel} must be an object.` }]
  }

  const issues: ValidationIssue[] = [
    ...validateRequiredString(value.id, '$.id', {
      trim: true,
      valueMessage: 'Provider id must be a non-empty string.'
    }),
    ...validateRequiredString(value.name, '$.name', {
      trim: true,
      valueMessage: 'Provider name must be a non-empty string.'
    }),
    ...validateRequiredString(value.externalIdSource, '$.externalIdSource', {
      trim: true,
      valueMessage: 'externalIdSource must be a non-empty string.'
    }),
    ...validateOptionalFunctionField(value.search, '$.search', 'search must be a function.'),
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

    // Capabilities are the single source of truth, so the declaration and the
    // implementation must agree in both directions: a declared search must be
    // callable, and an implemented search the host can never reach is a bug in
    // the provider rather than a silently ignored method.
    if (seen.has('search') && typeof value.search !== 'function') {
      issues.push({
        path: '$.search',
        message: 'Providers declaring the search capability must implement search.'
      })
    }

    if (!seen.has('search') && typeof value.search === 'function') {
      issues.push({
        path: '$.capabilities',
        message: 'Providers implementing search must declare the search capability.'
      })
    }
  }

  return issues
}

export function validateGameScraperProviderShape(value: unknown): ValidationIssue[] {
  return validateScraperProviderShape(value, GAME_SCRAPER_SLOTS, 'Game scraper provider')
}

export function validateAnimeScraperProviderShape(value: unknown): ValidationIssue[] {
  return validateScraperProviderShape(value, ANIME_SCRAPER_SLOTS, 'Anime scraper provider')
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

export function validateScraperSessionShape(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Scraper session must be an object.' }]
  }

  return [
    ...validateRequiredFunction(value.get, '$.get').map((issue) => ({
      ...issue,
      message: 'get must be a function.'
    })),
    ...validateOptionalFunctionField(value.dispose, '$.dispose', 'dispose must be a function.')
  ]
}

export function validateGameScraperSearchResults(value: unknown): ValidationIssue[] {
  return validateArrayOf(value, '$', 'Search results must be an array.', (item, path) =>
    validateGameSearchResult(item, path)
  )
}

export function validateAnimeScraperSearchResults(value: unknown): ValidationIssue[] {
  return validateArrayOf(value, '$', 'Search results must be an array.', (item, path) =>
    validateAnimeSearchResult(item, path)
  )
}

export function validatePersonScraperSearchResults(value: unknown): ValidationIssue[] {
  return validateArrayOf(value, '$', 'Search results must be an array.', (item, path) =>
    validatePersonSearchResult(item, path)
  )
}

export function validateCompanyScraperSearchResults(value: unknown): ValidationIssue[] {
  return validateArrayOf(value, '$', 'Search results must be an array.', (item, path) =>
    validateCompanySearchResult(item, path)
  )
}

export function validateCharacterScraperSearchResults(value: unknown): ValidationIssue[] {
  return validateArrayOf(value, '$', 'Search results must be an array.', (item, path) =>
    validateCharacterSearchResult(item, path)
  )
}

export function validateScraperResolvedTarget(value: unknown): ValidationIssue[] {
  if (value === null) {
    return []
  }

  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Resolved target must be an object or null.' }]
  }

  return [
    ...validateUnknownKeys(value, RESOLVED_TARGET_KEYS),
    ...validateRequiredString(value.cacheKey, '$.cacheKey', {
      trim: true,
      valueMessage: 'cacheKey must be a non-empty string.'
    }),
    ...validateRequiredString(value.id, '$.id', {
      trim: true,
      valueMessage: 'id must be a non-empty string.'
    }),
    ...validateOptionalString(value.resolveName, '$.resolveName'),
    ...validateOptionalIdentity(value.identity, '$.identity')
  ]
}

export function validateGameScraperSessionResults(value: unknown): ValidationIssue[] {
  return validateSessionResults(value, GAME_SESSION_KEYS, validateGameSessionSlot)
}

export function validateAnimeScraperSessionResults(value: unknown): ValidationIssue[] {
  return validateSessionResults(value, ANIME_SESSION_KEYS, validateAnimeSessionSlot)
}

export function validatePersonScraperSessionResults(value: unknown): ValidationIssue[] {
  return validateSessionResults(value, PERSON_SESSION_KEYS, validatePersonSessionSlot)
}

export function validateCompanyScraperSessionResults(value: unknown): ValidationIssue[] {
  return validateSessionResults(value, COMPANY_SESSION_KEYS, validateCompanySessionSlot)
}

export function validateCharacterScraperSessionResults(value: unknown): ValidationIssue[] {
  return validateSessionResults(value, CHARACTER_SESSION_KEYS, validateCharacterSessionSlot)
}

function validateGameSearchResult(value: unknown, path: string): ValidationIssue[] {
  const recordIssues = validateRecord(value, path, 'Game search result must be an object.')
  if (recordIssues) {
    return recordIssues
  }

  const result = value as Record<string, unknown>
  return [
    ...validateUnknownKeys(result, GAME_SEARCH_RESULT_KEYS, path),
    ...validateSearchResultBase(result, path),
    ...validateOptionalPartialDate(result.releaseDate, `${path}.releaseDate`)
  ]
}

function validateAnimeSearchResult(value: unknown, path: string): ValidationIssue[] {
  const recordIssues = validateRecord(value, path, 'Anime search result must be an object.')
  if (recordIssues) {
    return recordIssues
  }

  const result = value as Record<string, unknown>
  return [
    ...validateUnknownKeys(result, ANIME_SEARCH_RESULT_KEYS, path),
    ...validateSearchResultBase(result, path),
    ...validateOptionalPartialDate(result.releaseDate, `${path}.releaseDate`),
    ...validateOptionalEnumString(
      result.format,
      `${path}.format`,
      LIBRARY_ANIME_FORMATS,
      'format must be one of the supported anime formats.'
    )
  ]
}

function validatePersonSearchResult(value: unknown, path: string): ValidationIssue[] {
  const recordIssues = validateRecord(value, path, 'Person search result must be an object.')
  if (recordIssues) {
    return recordIssues
  }

  const result = value as Record<string, unknown>
  return [
    ...validateUnknownKeys(result, PERSON_SEARCH_RESULT_KEYS, path),
    ...validateSearchResultBase(result, path),
    ...validateOptionalPartialDate(result.birthDate, `${path}.birthDate`),
    ...validateOptionalPartialDate(result.deathDate, `${path}.deathDate`)
  ]
}

function validateCompanySearchResult(value: unknown, path: string): ValidationIssue[] {
  const recordIssues = validateRecord(value, path, 'Company search result must be an object.')
  if (recordIssues) {
    return recordIssues
  }

  const result = value as Record<string, unknown>
  return [
    ...validateUnknownKeys(result, COMPANY_SEARCH_RESULT_KEYS, path),
    ...validateSearchResultBase(result, path),
    ...validateOptionalPartialDate(result.foundedDate, `${path}.foundedDate`)
  ]
}

function validateCharacterSearchResult(value: unknown, path: string): ValidationIssue[] {
  const recordIssues = validateRecord(value, path, 'Character search result must be an object.')
  if (recordIssues) {
    return recordIssues
  }

  const result = value as Record<string, unknown>
  return [
    ...validateUnknownKeys(result, CHARACTER_SEARCH_RESULT_KEYS, path),
    ...validateSearchResultBase(result, path),
    ...validateOptionalPartialDate(result.birthDate, `${path}.birthDate`)
  ]
}

function validateSearchResultBase(
  result: Record<string, unknown>,
  path: string
): ValidationIssue[] {
  return [
    ...validateRequiredString(result.id, `${path}.id`, {
      trim: true,
      valueMessage: 'id must be a non-empty string.'
    }),
    ...validateRequiredString(result.name, `${path}.name`, {
      trim: true,
      valueMessage: 'name must be a non-empty string.'
    }),
    ...validateOptionalString(result.originalName, `${path}.originalName`),
    ...validateRequiredExternalIds(result.externalIds, `${path}.externalIds`)
  ]
}

function validateGameInfo(value: unknown, path: string): ValidationIssue[] {
  const recordIssues = validateRecord(value, path, 'Game info must be an object.')
  if (recordIssues) {
    return recordIssues
  }

  const info = value as Record<string, unknown>
  return [...validateUnknownKeys(info, GAME_INFO_KEYS, path), ...validateGameInfoFields(info, path)]
}

function validateAnimeInfo(value: unknown, path: string): ValidationIssue[] {
  const recordIssues = validateRecord(value, path, 'Anime info must be an object.')
  if (recordIssues) {
    return recordIssues
  }

  const info = value as Record<string, unknown>
  return [
    ...validateUnknownKeys(info, ANIME_INFO_KEYS, path),
    ...validateNamedInfoFields(info, path),
    ...validateOptionalStringArray(info.aliases, `${path}.aliases`, 'aliases must be an array.'),
    ...validateOptionalPartialDate(info.releaseDate, `${path}.releaseDate`),
    ...validateOptionalEnumString(
      info.format,
      `${path}.format`,
      LIBRARY_ANIME_FORMATS,
      'format must be one of the supported anime formats.'
    ),
    ...validateOptionalInteger(info.totalEpisodes, `${path}.totalEpisodes`)
  ]
}

function validateAnimeEpisode(value: unknown, path: string): ValidationIssue[] {
  const recordIssues = validateRecord(value, path, 'Anime episode must be an object.')
  if (recordIssues) {
    return recordIssues
  }

  const episode = value as Record<string, unknown>
  return [
    ...validateUnknownKeys(episode, ANIME_EPISODE_KEYS, path),
    ...validateRequiredFiniteNumber(episode.number, `${path}.number`),
    ...validateRequiredEnumString(
      episode.type,
      `${path}.type`,
      LIBRARY_ANIME_EPISODE_TYPES,
      'type must be one of the supported anime episode types.'
    ),
    ...validateOptionalString(episode.name, `${path}.name`),
    ...validateOptionalString(episode.originalName, `${path}.originalName`),
    ...validateOptionalPartialDate(episode.airDate, `${path}.airDate`),
    ...validateOptionalString(episode.description, `${path}.description`),
    ...validateOptionalFiniteNumber(episode.durationMs, `${path}.durationMs`),
    ...validateOptionalArrayOf(
      episode.externalIds,
      `${path}.externalIds`,
      'externalIds must be an array.',
      validateExternalId
    )
  ]
}

function validatePersonInfo(value: unknown, path: string): ValidationIssue[] {
  const recordIssues = validateRecord(value, path, 'Person info must be an object.')
  if (recordIssues) {
    return recordIssues
  }

  const info = value as Record<string, unknown>
  return [
    ...validateUnknownKeys(info, PERSON_INFO_KEYS, path),
    ...validatePersonInfoFields(info, path)
  ]
}

function validateCompanyInfo(value: unknown, path: string): ValidationIssue[] {
  const recordIssues = validateRecord(value, path, 'Company info must be an object.')
  if (recordIssues) {
    return recordIssues
  }

  const info = value as Record<string, unknown>
  return [
    ...validateUnknownKeys(info, COMPANY_INFO_KEYS, path),
    ...validateCompanyInfoFields(info, path)
  ]
}

function validateCharacterInfo(value: unknown, path: string): ValidationIssue[] {
  const recordIssues = validateRecord(value, path, 'Character info must be an object.')
  if (recordIssues) {
    return recordIssues
  }

  const info = value as Record<string, unknown>
  return [
    ...validateUnknownKeys(info, CHARACTER_INFO_KEYS, path),
    ...validateCharacterInfoFields(info, path)
  ]
}

function validateGameInfoFields(info: Record<string, unknown>, path: string): ValidationIssue[] {
  return [
    ...validateNamedInfoFields(info, path),
    ...validateOptionalStringArray(info.aliases, `${path}.aliases`, 'aliases must be an array.'),
    ...validateOptionalPartialDate(info.releaseDate, `${path}.releaseDate`)
  ]
}

function validatePersonInfoFields(info: Record<string, unknown>, path: string): ValidationIssue[] {
  return [
    ...validateNamedInfoFields(info, path),
    ...validateOptionalStringArray(info.aliases, `${path}.aliases`, 'aliases must be an array.'),
    ...validateOptionalPartialDate(info.birthDate, `${path}.birthDate`),
    ...validateOptionalPartialDate(info.deathDate, `${path}.deathDate`),
    ...validateOptionalEnumString(
      info.gender,
      `${path}.gender`,
      LIBRARY_GENDERS,
      'gender must be one of the supported library genders.'
    )
  ]
}

function validateCompanyInfoFields(info: Record<string, unknown>, path: string): ValidationIssue[] {
  return [
    ...validateNamedInfoFields(info, path),
    ...validateOptionalPartialDate(info.foundedDate, `${path}.foundedDate`)
  ]
}

function validateCharacterInfoFields(
  info: Record<string, unknown>,
  path: string
): ValidationIssue[] {
  return [
    ...validateNamedInfoFields(info, path),
    ...validateOptionalStringArray(info.aliases, `${path}.aliases`, 'aliases must be an array.'),
    ...validateOptionalPartialDate(info.birthDate, `${path}.birthDate`),
    ...validateOptionalEnumString(
      info.gender,
      `${path}.gender`,
      LIBRARY_GENDERS,
      'gender must be one of the supported library genders.'
    ),
    ...validateOptionalEnumString(
      info.bloodType,
      `${path}.bloodType`,
      LIBRARY_BLOOD_TYPES,
      'bloodType must be one of the supported library blood types.'
    ),
    ...validateOptionalEnumString(
      info.cup,
      `${path}.cup`,
      LIBRARY_CUP_SIZES,
      'cup must be one of the supported library cup sizes.'
    ),
    ...validateOptionalFiniteNumber(info.age, `${path}.age`),
    ...validateOptionalFiniteNumber(info.height, `${path}.height`),
    ...validateOptionalFiniteNumber(info.weight, `${path}.weight`),
    ...validateOptionalFiniteNumber(info.bust, `${path}.bust`),
    ...validateOptionalFiniteNumber(info.waist, `${path}.waist`),
    ...validateOptionalFiniteNumber(info.hips, `${path}.hips`)
  ]
}

function validatePersonMetadataFields(
  info: Record<string, unknown>,
  path: string
): ValidationIssue[] {
  return [
    ...validatePersonInfoFields(info, path),
    ...validateRequiredIdentity(info.identity, `${path}.identity`),
    ...validateOptionalTags(info.tags, `${path}.tags`),
    ...validateOptionalStringArray(info.photos, `${path}.photos`, 'photos must be an array.')
  ]
}

function validateCompanyMetadataFields(
  info: Record<string, unknown>,
  path: string
): ValidationIssue[] {
  return [
    ...validateCompanyInfoFields(info, path),
    ...validateRequiredIdentity(info.identity, `${path}.identity`),
    ...validateOptionalTags(info.tags, `${path}.tags`),
    ...validateOptionalStringArray(info.logos, `${path}.logos`, 'logos must be an array.')
  ]
}

function validateCharacterMetadataFields(
  info: Record<string, unknown>,
  path: string
): ValidationIssue[] {
  return [
    ...validateCharacterInfoFields(info, path),
    ...validateRequiredIdentity(info.identity, `${path}.identity`),
    ...validateOptionalTags(info.tags, `${path}.tags`),
    ...validateOptionalStringArray(info.photos, `${path}.photos`, 'photos must be an array.'),
    ...validateOptionalArrayOf(
      info.persons,
      `${path}.persons`,
      'persons must be an array.',
      validateCharacterPersonFact
    )
  ]
}

function validateNamedInfoFields(info: Record<string, unknown>, path: string): ValidationIssue[] {
  return [
    ...validateRequiredString(info.name, `${path}.name`, {
      trim: true,
      valueMessage: 'name must be a non-empty string.'
    }),
    ...validateOptionalString(info.originalName, `${path}.originalName`),
    ...validateOptionalString(info.description, `${path}.description`),
    ...validateOptionalExternalSites(info.externalSites, `${path}.externalSites`)
  ]
}

function validateGamePersonFact(value: unknown, path: string): ValidationIssue[] {
  return [
    ...validateFactObject(value, path, GAME_PERSON_FACT_KEYS, validatePersonMetadataFields),
    ...validateFactFields(value, path),
    ...validateRequiredFactRole(value, path, LIBRARY_GAME_PERSON_ROLES, 'game person role')
  ]
}

function validateGameCompanyFact(value: unknown, path: string): ValidationIssue[] {
  return [
    ...validateFactObject(value, path, GAME_COMPANY_FACT_KEYS, validateCompanyMetadataFields),
    ...validateFactFields(value, path),
    ...validateRequiredFactRole(value, path, LIBRARY_GAME_COMPANY_ROLES, 'game company role')
  ]
}

function validateGameCharacterFact(value: unknown, path: string): ValidationIssue[] {
  return [
    ...validateFactObject(value, path, GAME_CHARACTER_FACT_KEYS, validateCharacterMetadataFields),
    ...validateFactFields(value, path),
    ...validateRequiredFactRole(value, path, LIBRARY_GAME_CHARACTER_ROLES, 'game character role')
  ]
}

function validateAnimePersonFact(value: unknown, path: string): ValidationIssue[] {
  return [
    ...validateFactObject(value, path, ANIME_PERSON_FACT_KEYS, validatePersonMetadataFields),
    ...validateFactFields(value, path),
    ...validateRequiredFactRole(value, path, LIBRARY_ANIME_PERSON_ROLES, 'anime person role')
  ]
}

function validateAnimeCompanyFact(value: unknown, path: string): ValidationIssue[] {
  return [
    ...validateFactObject(value, path, ANIME_COMPANY_FACT_KEYS, validateCompanyMetadataFields),
    ...validateFactFields(value, path),
    ...validateRequiredFactRole(value, path, LIBRARY_ANIME_COMPANY_ROLES, 'anime company role')
  ]
}

function validateAnimeCharacterFact(value: unknown, path: string): ValidationIssue[] {
  return [
    ...validateFactObject(value, path, ANIME_CHARACTER_FACT_KEYS, validateCharacterMetadataFields),
    ...validateFactFields(value, path),
    ...validateRequiredFactRole(value, path, LIBRARY_ANIME_CHARACTER_ROLES, 'anime character role')
  ]
}

function validateCharacterPersonFact(value: unknown, path: string): ValidationIssue[] {
  return [
    ...validateFactObject(value, path, CHARACTER_PERSON_FACT_KEYS, validatePersonMetadataFields),
    ...validateFactFields(value, path),
    ...validateOptionalCharacterInfo(value, path),
    ...validateRequiredFactRole(
      value,
      path,
      LIBRARY_CHARACTER_PERSON_ROLES,
      'character person role'
    )
  ]
}

function validateRelatedEntryFact(value: unknown, path: string): ValidationIssue[] {
  const recordIssues = validateRecord(value, path, 'Scraped related entry must be an object.')
  if (recordIssues) {
    return recordIssues
  }

  const fact = value as Record<string, unknown>
  return [
    ...validateUnknownKeys(fact, RELATED_ENTRY_FACT_KEYS, path),
    ...validateRequiredEnumString(
      fact.mediaType,
      `${path}.mediaType`,
      LIBRARY_MEDIA_TYPES,
      'mediaType must be one of the supported media types.'
    ),
    ...validateRequiredString(fact.source, `${path}.source`, {
      trim: true,
      valueMessage: 'source must be a non-empty string.'
    }),
    ...validateRequiredString(fact.externalId, `${path}.externalId`, {
      trim: true,
      valueMessage: 'externalId must be a non-empty string.'
    }),
    ...validateRequiredEnumString(
      fact.type,
      `${path}.type`,
      LIBRARY_MEDIA_RELATION_TYPES,
      'type must be one of the supported media relation types.'
    ),
    ...validateOptionalString(fact.note, `${path}.note`)
  ]
}

function validateFactObject(
  value: unknown,
  path: string,
  allowedKeys: ReadonlySet<string>,
  validateBase: (value: Record<string, unknown>, path: string) => ValidationIssue[]
): ValidationIssue[] {
  const recordIssues = validateRecord(value, path, 'Scraped relation fact must be an object.')
  if (recordIssues) {
    return recordIssues
  }

  return [
    ...validateUnknownKeys(value as Record<string, unknown>, allowedKeys, path),
    ...validateBase(value as Record<string, unknown>, path)
  ]
}

function validateFactFields(value: unknown, path: string): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return []
  }

  return [
    ...validateOptionalBoolean(value.isSpoiler, `${path}.isSpoiler`),
    ...validateOptionalString(value.note, `${path}.note`)
  ]
}

function validateOptionalCharacterInfo(value: unknown, path: string): ValidationIssue[] {
  if (!isPlainObject(value) || value.character === undefined) {
    return []
  }

  const issues = validateRecord(
    value.character,
    `${path}.character`,
    'Character info must be an object.'
  )
  if (issues) {
    return issues
  }

  const character = value.character as Record<string, unknown>
  return [
    ...validateUnknownKeys(character, CHARACTER_REFERENCE_KEYS, `${path}.character`),
    ...validateCharacterInfoFields(character, `${path}.character`),
    ...validateRequiredIdentity(character.identity, `${path}.character.identity`)
  ]
}

function validateRequiredFactRole<TValue extends string>(
  value: unknown,
  path: string,
  allowedValues: readonly TValue[],
  label: string
): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return []
  }

  return validateRequiredEnumString(
    value.role,
    `${path}.role`,
    allowedValues,
    `role must be one of the supported ${label}s.`
  )
}

function validateGameSessionSlot(slot: GameScraperSlot, value: unknown, path: string) {
  switch (slot) {
    case 'info':
      return validateGameInfo(value, path)
    case 'tags':
      return validateArrayOf(value, path, 'tags must be an array.', validateScrapedTag)
    case 'characters':
      return validateArrayOf(value, path, 'characters must be an array.', validateGameCharacterFact)
    case 'persons':
      return validateArrayOf(value, path, 'persons must be an array.', validateGamePersonFact)
    case 'companies':
      return validateArrayOf(value, path, 'companies must be an array.', validateGameCompanyFact)
    case 'relatedEntries':
      return validateArrayOf(
        value,
        path,
        'relatedEntries must be an array.',
        validateRelatedEntryFact
      )
    case 'covers':
    case 'backdrops':
    case 'logos':
    case 'icons':
      return validateStringArray(value, path, `${slot} must be an array of strings.`)
  }

  return []
}

function validateAnimeSessionSlot(slot: AnimeScraperSlot, value: unknown, path: string) {
  switch (slot) {
    case 'info':
      return validateAnimeInfo(value, path)
    case 'tags':
      return validateArrayOf(value, path, 'tags must be an array.', validateScrapedTag)
    case 'episodes':
      return validateArrayOf(value, path, 'episodes must be an array.', validateAnimeEpisode)
    case 'characters':
      return validateArrayOf(
        value,
        path,
        'characters must be an array.',
        validateAnimeCharacterFact
      )
    case 'persons':
      return validateArrayOf(value, path, 'persons must be an array.', validateAnimePersonFact)
    case 'companies':
      return validateArrayOf(value, path, 'companies must be an array.', validateAnimeCompanyFact)
    case 'relatedEntries':
      return validateArrayOf(
        value,
        path,
        'relatedEntries must be an array.',
        validateRelatedEntryFact
      )
    case 'covers':
    case 'backdrops':
    case 'logos':
      return validateStringArray(value, path, `${slot} must be an array of strings.`)
  }

  return []
}

function validatePersonSessionSlot(slot: PersonScraperSlot, value: unknown, path: string) {
  switch (slot) {
    case 'info':
      return validatePersonInfo(value, path)
    case 'tags':
      return validateArrayOf(value, path, 'tags must be an array.', validateScrapedTag)
    case 'photos':
      return validateStringArray(value, path, 'photos must be an array of strings.')
  }

  return []
}

function validateCompanySessionSlot(slot: CompanyScraperSlot, value: unknown, path: string) {
  switch (slot) {
    case 'info':
      return validateCompanyInfo(value, path)
    case 'tags':
      return validateArrayOf(value, path, 'tags must be an array.', validateScrapedTag)
    case 'logos':
      return validateStringArray(value, path, 'logos must be an array of strings.')
  }

  return []
}

function validateCharacterSessionSlot(slot: CharacterScraperSlot, value: unknown, path: string) {
  switch (slot) {
    case 'info':
      return validateCharacterInfo(value, path)
    case 'tags':
      return validateArrayOf(value, path, 'tags must be an array.', validateScrapedTag)
    case 'persons':
      return validateArrayOf(value, path, 'persons must be an array.', validateCharacterPersonFact)
    case 'photos':
      return validateStringArray(value, path, 'photos must be an array of strings.')
  }

  return []
}

function validateSessionResults<TSlot extends string>(
  value: unknown,
  allowedSlots: ReadonlySet<TSlot>,
  validateSlot: (slot: TSlot, value: unknown, path: string) => ValidationIssue[]
): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Session result must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(value, SESSION_RESULT_KEYS),
    ...validateOptionalIdentity(value.identity, '$.identity')
  ]

  const slotsIssues = validateRecord(value.slots, '$.slots', 'slots must be an object.')
  if (slotsIssues) {
    issues.push(...slotsIssues)
    return issues
  }

  const slots = value.slots as Record<string, unknown>
  issues.push(...validateUnknownKeys(slots, allowedSlots as ReadonlySet<string>, '$.slots'))

  for (const key of Object.keys(slots)) {
    if (!allowedSlots.has(key as TSlot)) {
      continue
    }

    issues.push(...validateSlot(key as TSlot, slots[key], `$.slots.${key}`))
  }
  return issues
}

function validateScrapedTag(value: unknown, path: string): ValidationIssue[] {
  const recordIssues = validateRecord(value, path, 'Tag must be an object.')
  if (recordIssues) {
    return recordIssues
  }

  const tag = value as Record<string, unknown>
  return [
    ...validateUnknownKeys(tag, SCRAPED_TAG_KEYS, path),
    ...validateRequiredString(tag.name, `${path}.name`, {
      trim: true,
      valueMessage: 'name must be a non-empty string.'
    }),
    ...validateOptionalBoolean(tag.isSpoiler, `${path}.isSpoiler`),
    ...validateOptionalBoolean(tag.isNsfw, `${path}.isNsfw`),
    ...validateOptionalString(tag.note, `${path}.note`)
  ]
}

function validateRequiredExternalIds(value: unknown, path: string): ValidationIssue[] {
  return validateArrayOf(value, path, 'externalIds must be an array.', validateExternalId)
}

function validateRequiredIdentity(value: unknown, path: string): ValidationIssue[] {
  const recordIssues = validateRecord(value, path, 'identity must be an object.')
  if (recordIssues) {
    return recordIssues
  }

  const identity = value as Record<string, unknown>
  return [
    ...validateUnknownKeys(identity, SCRAPED_IDENTITY_KEYS, path),
    ...validateRequiredExternalIds(identity.externalIds, `${path}.externalIds`)
  ]
}

function validateOptionalIdentity(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  return validateRequiredIdentity(value, path)
}

function validateExternalId(value: unknown, path: string): ValidationIssue[] {
  const recordIssues = validateRecord(value, path, 'External id must be an object.')
  if (recordIssues) {
    return recordIssues
  }

  const externalId = value as Record<string, unknown>
  return [
    ...validateUnknownKeys(externalId, EXTERNAL_ID_KEYS, path),
    ...validateRequiredString(externalId.source, `${path}.source`, {
      trim: true,
      valueMessage: 'source must be a non-empty string.'
    }),
    ...validateRequiredString(externalId.id, `${path}.id`, {
      trim: true,
      valueMessage: 'id must be a non-empty string.'
    })
  ]
}

function validateOptionalExternalSites(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  return validateArrayOf(value, path, 'externalSites must be an array.', validateExternalSite)
}

function validateExternalSite(value: unknown, path: string): ValidationIssue[] {
  const recordIssues = validateRecord(value, path, 'Related site must be an object.')
  if (recordIssues) {
    return recordIssues
  }

  const site = value as Record<string, unknown>
  return [
    ...validateUnknownKeys(site, RELATED_SITE_KEYS, path),
    ...validateRequiredString(site.label, `${path}.label`, {
      trim: true,
      valueMessage: 'label must be a non-empty string.'
    }),
    ...validateRequiredString(site.url, `${path}.url`, {
      trim: true,
      valueMessage: 'url must be a non-empty string.'
    })
  ]
}

function validateOptionalPartialDate(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  const recordIssues = validateRecord(value, path, 'Partial date must be an object.')
  if (recordIssues) {
    return recordIssues
  }

  const date = value as Record<string, unknown>
  return [
    ...validateUnknownKeys(date, PARTIAL_DATE_KEYS, path),
    ...validateOptionalInteger(date.year, `${path}.year`),
    ...validateOptionalIntegerInRange(date.month, `${path}.month`, 1, 12),
    ...validateOptionalIntegerInRange(date.day, `${path}.day`, 1, 31)
  ]
}

function validateOptionalInteger(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return [{ path, message: 'Field must be an integer.' }]
  }

  return []
}

function validateOptionalIntegerInRange(
  value: unknown,
  path: string,
  min: number,
  max: number
): ValidationIssue[] {
  const issues = validateOptionalInteger(value, path)
  if (typeof value === 'number' && Number.isInteger(value) && (value < min || value > max)) {
    issues.push({ path, message: `Field must be from ${min} to ${max}.` })
  }
  return issues
}

function validateStringArray(value: unknown, path: string, typeMessage: string): ValidationIssue[] {
  return validateArrayOf(value, path, typeMessage, (item, itemPath) =>
    typeof item === 'string' ? [] : [{ path: itemPath, message: 'Array item must be a string.' }]
  )
}

function validateOptionalStringArray(
  value: unknown,
  path: string,
  typeMessage: string
): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  return validateStringArray(value, path, typeMessage)
}

function validateOptionalTags(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  return validateArrayOf(value, path, 'tags must be an array.', validateScrapedTag)
}

function validateOptionalArrayOf(
  value: unknown,
  path: string,
  typeMessage: string,
  validateItem: (item: unknown, path: string) => ValidationIssue[]
): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  return validateArrayOf(value, path, typeMessage, validateItem)
}

function validateArrayOf(
  value: unknown,
  path: string,
  typeMessage: string,
  validateItem: (item: unknown, path: string) => ValidationIssue[]
): ValidationIssue[] {
  const issues = validateRequiredArray(value, path, { typeMessage })
  if (!Array.isArray(value)) {
    return issues
  }

  for (const [index, item] of value.entries()) {
    issues.push(...validateItem(item, `${path}[${index}]`))
  }
  return issues
}

function validateOptionalFunctionField(
  value: unknown,
  path: string,
  message: string
): ValidationIssue[] {
  if (value === undefined || typeof value === 'function') {
    return []
  }

  return [{ path, message }]
}

function validateRecord(value: unknown, path: string, message: string): ValidationIssue[] | null {
  if (isPlainObject(value)) {
    return null
  }

  return [{ path, message }]
}
