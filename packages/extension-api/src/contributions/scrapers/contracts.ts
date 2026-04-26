import type { Disposable, ExternalId, Locale, PartialDate, RelatedSite } from '../../shared'
import type {
  LibraryBloodType,
  LibraryCharacterPersonRole,
  LibraryCupSize,
  LibraryGameCharacterRole,
  LibraryGameCompanyRole,
  LibraryGamePersonRole,
  LibraryGender
} from '../../shared/library'

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
