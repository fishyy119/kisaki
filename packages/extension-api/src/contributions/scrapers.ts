import type { Disposable, ExternalId, Locale, PartialDate, RelatedSite } from '../shared'
import type {
  LibraryBloodType,
  LibraryCharacterPersonRole,
  LibraryCupSize,
  LibraryGameCharacterRole,
  LibraryGameCompanyRole,
  LibraryGamePersonRole,
  LibraryGender
} from '../capabilities/library'
import type { ValidationIssue } from '../shared/validation'
import {
  isPlainObject,
  validateRequiredArray,
  validateRequiredFunction,
  validateRequiredString,
  validateUnknownKeys
} from '../shared/validation'

export const SCRAPER_MEDIA_TYPES = ['game', 'person', 'company', 'character'] as const

export type ScraperMediaType = (typeof SCRAPER_MEDIA_TYPES)[number]

export const GAME_SCRAPER_SLOTS = [
  'info',
  'tags',
  'characters',
  'persons',
  'companies',
  'covers',
  'backdrops',
  'logos',
  'icons'
] as const

export type GameScraperSlot = (typeof GAME_SCRAPER_SLOTS)[number]

export const PERSON_SCRAPER_SLOTS = ['info', 'tags', 'photos'] as const

export type PersonScraperSlot = (typeof PERSON_SCRAPER_SLOTS)[number]

export const COMPANY_SCRAPER_SLOTS = ['info', 'tags', 'logos'] as const

export type CompanyScraperSlot = (typeof COMPANY_SCRAPER_SLOTS)[number]

export const CHARACTER_SCRAPER_SLOTS = ['info', 'tags', 'persons', 'photos'] as const

export type CharacterScraperSlot = (typeof CHARACTER_SCRAPER_SLOTS)[number]

export type ScraperSlot =
  | GameScraperSlot
  | PersonScraperSlot
  | CompanyScraperSlot
  | CharacterScraperSlot

export type ScraperCapability = 'search' | ScraperSlot

export interface ScraperLookup {
  name: string
  locale?: Locale
  knownIds?: readonly ExternalId[]
}

export interface ScrapedTag {
  name: string
  isSpoiler?: boolean
  note?: string
  isNsfw?: boolean
}

export interface ScrapedGameInfo {
  name: string
  originalName?: string
  releaseDate?: PartialDate
  description?: string
  relatedSites?: readonly RelatedSite[]
  externalIds: readonly ExternalId[]
}

export interface ScrapedPersonInfo {
  name: string
  originalName?: string
  birthDate?: PartialDate
  deathDate?: PartialDate
  gender?: LibraryGender
  description?: string
  relatedSites?: readonly RelatedSite[]
  externalIds: readonly ExternalId[]
}

export interface ScrapedCompanyInfo {
  name: string
  originalName?: string
  foundedDate?: PartialDate
  description?: string
  relatedSites?: readonly RelatedSite[]
  externalIds: readonly ExternalId[]
}

export interface ScrapedCharacterInfo {
  name: string
  originalName?: string
  birthDate?: PartialDate
  gender?: LibraryGender
  age?: number
  bloodType?: LibraryBloodType
  height?: number
  weight?: number
  bust?: number
  waist?: number
  hips?: number
  cup?: LibraryCupSize
  description?: string
  relatedSites?: readonly RelatedSite[]
  externalIds: readonly ExternalId[]
}

export interface ScrapedGamePersonFact extends ScrapedPersonInfo {
  type: LibraryGamePersonRole
  isSpoiler?: boolean
  note?: string
}

export interface ScrapedGameCompanyFact extends ScrapedCompanyInfo {
  type: LibraryGameCompanyRole
  isSpoiler?: boolean
  note?: string
}

export interface ScrapedCharacterPersonFact extends ScrapedPersonInfo {
  type: LibraryCharacterPersonRole
  isSpoiler?: boolean
  note?: string
}

export interface ScrapedGameCharacterFact extends ScrapedCharacterInfo {
  type: LibraryGameCharacterRole
  isSpoiler?: boolean
  note?: string
}

export interface ScrapedGameBundle {
  core?: ScrapedGameInfo
  tags?: readonly ScrapedTag[]
  persons?: readonly ScrapedGamePersonFact[]
  companies?: readonly ScrapedGameCompanyFact[]
  characters?: readonly ScrapedGameCharacterFact[]
  covers?: readonly string[]
  backdrops?: readonly string[]
  logos?: readonly string[]
  icons?: readonly string[]
}

export interface ScrapedPersonBundle {
  core?: ScrapedPersonInfo
  tags?: readonly ScrapedTag[]
  photos?: readonly string[]
}

export interface ScrapedCompanyBundle {
  core?: ScrapedCompanyInfo
  tags?: readonly ScrapedTag[]
  logos?: readonly string[]
}

export interface ScrapedCharacterBundle {
  core?: ScrapedCharacterInfo
  tags?: readonly ScrapedTag[]
  persons?: readonly ScrapedCharacterPersonFact[]
  photos?: readonly string[]
}

export interface BaseResolvedTarget {
  cacheKey: string
  resolveName?: string
}

export interface IdResolvedTarget extends BaseResolvedTarget {
  id: string
}

export interface BaseScraperSession<
  TSlot extends string,
  TResultMap extends Partial<Record<TSlot, unknown>>
> {
  get(slots: readonly TSlot[]): Promise<Partial<TResultMap>>
  dispose?(): Promise<void>
}

export interface GameSearchResult {
  id: string
  name: string
  originalName?: string
  releaseDate?: PartialDate
  externalIds: readonly ExternalId[]
}

export interface PersonSearchResult {
  id: string
  name: string
  originalName?: string
  birthDate?: PartialDate
  deathDate?: PartialDate
  externalIds: readonly ExternalId[]
}

export interface CompanySearchResult {
  id: string
  name: string
  originalName?: string
  foundedDate?: PartialDate
  externalIds: readonly ExternalId[]
}

export interface CharacterSearchResult {
  id: string
  name: string
  originalName?: string
  birthDate?: PartialDate
  externalIds: readonly ExternalId[]
}

export interface GameSessionResultMap {
  info: ScrapedGameInfo
  tags: ScrapedTag[]
  characters: ScrapedGameCharacterFact[]
  persons: ScrapedGamePersonFact[]
  companies: ScrapedGameCompanyFact[]
  covers: string[]
  backdrops: string[]
  logos: string[]
  icons: string[]
}

export interface PersonSessionResultMap {
  info: ScrapedPersonInfo
  tags: ScrapedTag[]
  photos: string[]
}

export interface CompanySessionResultMap {
  info: ScrapedCompanyInfo
  tags: ScrapedTag[]
  logos: string[]
}

export interface CharacterSessionResultMap {
  info: ScrapedCharacterInfo
  tags: ScrapedTag[]
  persons: ScrapedCharacterPersonFact[]
  photos: string[]
}

export type GameScraperSession = BaseScraperSession<GameScraperSlot, GameSessionResultMap>

export type PersonScraperSession = BaseScraperSession<PersonScraperSlot, PersonSessionResultMap>

export type CompanyScraperSession = BaseScraperSession<CompanyScraperSlot, CompanySessionResultMap>

export type CharacterScraperSession = BaseScraperSession<
  CharacterScraperSlot,
  CharacterSessionResultMap
>

export interface BaseScraperProvider {
  readonly id: string
  readonly name: string
  readonly capabilities: readonly ScraperCapability[]
}

export interface GameScraperProvider extends BaseScraperProvider {
  search(query: string, locale?: Locale): Promise<readonly GameSearchResult[]>
  resolve(lookup: ScraperLookup, locale: Locale): Promise<IdResolvedTarget | null>
  openSession(target: IdResolvedTarget, locale: Locale): Promise<GameScraperSession>
}

export interface PersonScraperProvider extends BaseScraperProvider {
  search(query: string, locale?: Locale): Promise<readonly PersonSearchResult[]>
  resolve(lookup: ScraperLookup, locale: Locale): Promise<IdResolvedTarget | null>
  openSession(target: IdResolvedTarget, locale: Locale): Promise<PersonScraperSession>
}

export interface CompanyScraperProvider extends BaseScraperProvider {
  search(query: string, locale?: Locale): Promise<readonly CompanySearchResult[]>
  resolve(lookup: ScraperLookup, locale: Locale): Promise<IdResolvedTarget | null>
  openSession(target: IdResolvedTarget, locale: Locale): Promise<CompanyScraperSession>
}

export interface CharacterScraperProvider extends BaseScraperProvider {
  search(query: string, locale?: Locale): Promise<readonly CharacterSearchResult[]>
  resolve(lookup: ScraperLookup, locale: Locale): Promise<IdResolvedTarget | null>
  openSession(target: IdResolvedTarget, locale: Locale): Promise<CharacterScraperSession>
}

export interface ScraperRegistrar {
  registerGameProvider(provider: GameScraperProvider): Disposable
  registerPersonProvider(provider: PersonScraperProvider): Disposable
  registerCompanyProvider(provider: CompanyScraperProvider): Disposable
  registerCharacterProvider(provider: CharacterScraperProvider): Disposable
}

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
