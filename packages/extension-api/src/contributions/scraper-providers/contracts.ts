import type { Disposable, ExternalId, ContentLocale, PartialDate, ExternalSite } from '../../shared'
import type {
  LibraryAnimeCharacterRole,
  LibraryAnimeCompanyRole,
  LibraryAnimeEpisodeType,
  LibraryAnimeFormat,
  LibraryAnimePersonRole,
  LibraryBloodType,
  LibraryCharacterPersonRole,
  LibraryCupSize,
  LibraryGameCharacterRole,
  LibraryGameCompanyRole,
  LibraryGamePersonRole,
  LibraryGender,
  LibraryMediaRelationType,
  LibraryMovieCharacterRole,
  LibraryMovieCompanyRole,
  LibraryMovieFormat,
  LibraryMoviePersonRole,
  LibraryTvCharacterRole,
  LibraryTvCompanyRole,
  LibraryTvFormat,
  LibraryTvPersonRole
} from '../../shared/library'
import type { LibraryMediaType } from '../../capabilities/library/graph'

export const SCRAPER_MEDIA_TYPES = [
  'game',
  'anime',
  'tv',
  'movie',
  'person',
  'company',
  'character'
] as const

export type ScraperMediaType = (typeof SCRAPER_MEDIA_TYPES)[number]

export const GAME_SCRAPER_SLOTS = [
  'info',
  'tags',
  'characters',
  'persons',
  'companies',
  'relatedEntries',
  'covers',
  'backdrops',
  'logos',
  'icons'
] as const

export type GameScraperSlot = (typeof GAME_SCRAPER_SLOTS)[number]

export const ANIME_SCRAPER_SLOTS = [
  'info',
  'tags',
  'episodes',
  'characters',
  'persons',
  'companies',
  'relatedEntries',
  'covers',
  'backdrops',
  'logos'
] as const

export type AnimeScraperSlot = (typeof ANIME_SCRAPER_SLOTS)[number]

export const TV_SCRAPER_SLOTS = [
  'info',
  'tags',
  'seasons',
  'episodes',
  'characters',
  'persons',
  'companies',
  'relatedEntries',
  'covers',
  'backdrops',
  'logos'
] as const

export type TvScraperSlot = (typeof TV_SCRAPER_SLOTS)[number]

export const MOVIE_SCRAPER_SLOTS = [
  'info',
  'tags',
  'characters',
  'persons',
  'companies',
  'relatedEntries',
  'covers',
  'backdrops',
  'logos'
] as const

export type MovieScraperSlot = (typeof MOVIE_SCRAPER_SLOTS)[number]

export const PERSON_SCRAPER_SLOTS = ['info', 'tags', 'photos'] as const

export type PersonScraperSlot = (typeof PERSON_SCRAPER_SLOTS)[number]

export const COMPANY_SCRAPER_SLOTS = ['info', 'tags', 'logos'] as const

export type CompanyScraperSlot = (typeof COMPANY_SCRAPER_SLOTS)[number]

export const CHARACTER_SCRAPER_SLOTS = ['info', 'tags', 'persons', 'photos'] as const

export type CharacterScraperSlot = (typeof CHARACTER_SCRAPER_SLOTS)[number]

export type ScraperSlot =
  | GameScraperSlot
  | AnimeScraperSlot
  | TvScraperSlot
  | MovieScraperSlot
  | PersonScraperSlot
  | CompanyScraperSlot
  | CharacterScraperSlot

export type ScraperCapability<TSlot extends ScraperSlot = ScraperSlot> = 'search' | TSlot

/**
 * What the host knows about the entry a provider should resolve.
 *
 * `knownIds` names the entry outright: when it carries the provider's own
 * source, the provider uses that id and searches nothing. Media types whose
 * entries need more than a name to be told apart extend this contract with the
 * facts their providers can disambiguate on.
 */
export interface ScraperLookup {
  name: string
  locale?: ContentLocale
  knownIds?: readonly ExternalId[]
}

/**
 * Lookup for a media entry (game, anime).
 *
 * The facts only matter to a name search, where one work spans many provider
 * entries: TMDB offers every season of a show plus its specials collection
 * under the same name. They are hints, never overrides — a provider that can
 * identify the entry by id ignores them — and any of them may be absent, so a
 * provider must still answer without them.
 */
export interface MediaScraperLookup extends ScraperLookup {
  /** Release date of the entry, as precise as the host knows it. */
  releaseDate?: PartialDate
}

/** Lookup for an anime entry, adding its release format to the media facts. */
export interface AnimeScraperLookup extends MediaScraperLookup {
  format?: LibraryAnimeFormat
}

/**
 * Lookup for a tv entry, adding its production format to the media facts.
 *
 * The format tells providers which kind of entry to look for when a name search
 * spans several: a franchise name can name a scripted series, its documentary
 * companion, and a talk show at once.
 */
export interface TvScraperLookup extends MediaScraperLookup {
  format?: LibraryTvFormat
}

/** Lookup for a movie entry, adding its release format to the media facts. */
export interface MovieScraperLookup extends MediaScraperLookup {
  format?: LibraryMovieFormat
}

/** Lookup for a game entry; game entries state no facts beyond the media ones. */
export type GameScraperLookup = MediaScraperLookup

/**
 * Invocation-scoped context passed to every scraper provider call.
 *
 * The host resolves both members, so providers never re-derive the locale nor
 * handle a missing signal. `signal` aborts when the requesting side gives up:
 * providers should forward it to network work and stop early, but cancellation
 * is cooperative, so ignoring it only means the call keeps running until it
 * finishes on its own.
 */
export interface ScraperProviderContext {
  locale: ContentLocale
  signal: AbortSignal
}

export interface ScrapedEntityIdentity {
  externalIds: readonly ExternalId[]
}

export interface ScrapedIdentityCarrier {
  identity: ScrapedEntityIdentity
}

export type ScraperSessionResult<TResultMap extends object> = {
  identity?: ScrapedEntityIdentity
  slots: Partial<TResultMap>
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
  externalSites?: readonly ExternalSite[]
}

export interface ScrapedAnimeInfo {
  name: string
  originalName?: string
  releaseDate?: PartialDate
  description?: string
  format?: LibraryAnimeFormat
  /** Episode count declared by the source; episode rows stay authoritative. */
  totalEpisodes?: number
  externalSites?: readonly ExternalSite[]
}

/**
 * One episode of an anime entry.
 *
 * `externalIds` carries per-episode identity so re-scrapes realign existing
 * rows by id rather than by number, which sources revise. Sources describe
 * more episode kinds than the library tracks: providers map their source's
 * vocabulary onto `regular`/`special` and omit the kinds the library does not
 * track (openings, endings, and trailers are not episodes; local files for
 * them are recognized as extras by the scanner). Validation rejects unknown
 * `type` values.
 */
export interface ScrapedAnimeEpisode {
  number: number
  type: LibraryAnimeEpisodeType
  name?: string
  originalName?: string
  airDate?: PartialDate
  description?: string
  durationMs?: number
  externalIds?: readonly ExternalId[]
}

export interface ScrapedTvInfo {
  name: string
  originalName?: string
  /** First air date of the show; season air dates travel with the seasons. */
  releaseDate?: PartialDate
  /** Last air date; omit while the show is still running. */
  endDate?: PartialDate
  description?: string
  format?: LibraryTvFormat
  /** Counts declared by the source; season and episode rows stay authoritative. */
  totalSeasons?: number
  totalEpisodes?: number
  externalSites?: readonly ExternalSite[]
}

/**
 * One season of a show.
 *
 * Seasons are addressed by number rather than external id: the number is the
 * one key every source agrees on, and a season carries no user data that a
 * realignment could lose.
 */
export interface ScrapedTvSeason {
  /** Season 0 holds specials; regular seasons start at 1. */
  number: number
  name?: string
  originalName?: string
  airDate?: PartialDate
  description?: string
  totalEpisodes?: number
}

/**
 * One episode of a show.
 *
 * `externalIds` carries per-episode identity so re-scrapes realign existing
 * rows by id rather than by number, which sources revise. Specials are the
 * episodes of season 0 rather than a separate kind.
 */
export interface ScrapedTvEpisode {
  /** Season the episode belongs to; 0 for specials. */
  seasonNumber: number
  number: number
  name?: string
  originalName?: string
  airDate?: PartialDate
  description?: string
  durationMs?: number
  externalIds?: readonly ExternalId[]
}

export interface ScrapedMovieInfo {
  name: string
  originalName?: string
  releaseDate?: PartialDate
  description?: string
  format?: LibraryMovieFormat
  /** Runtime declared by the source; probed file durations stay authoritative. */
  runtimeMs?: number
  externalSites?: readonly ExternalSite[]
}

export interface ScrapedPersonInfo {
  name: string
  originalName?: string
  birthDate?: PartialDate
  deathDate?: PartialDate
  gender?: LibraryGender
  description?: string
  externalSites?: readonly ExternalSite[]
}

export interface ScrapedCompanyInfo {
  name: string
  originalName?: string
  foundedDate?: PartialDate
  description?: string
  externalSites?: readonly ExternalSite[]
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
  externalSites?: readonly ExternalSite[]
}

export interface ScrapedPersonMetadata extends ScrapedPersonInfo, ScrapedIdentityCarrier {
  tags?: readonly ScrapedTag[]
  photos?: readonly string[]
}

export interface ScrapedCompanyMetadata extends ScrapedCompanyInfo, ScrapedIdentityCarrier {
  tags?: readonly ScrapedTag[]
  logos?: readonly string[]
}

export interface ScrapedCharacterMetadata extends ScrapedCharacterInfo, ScrapedIdentityCarrier {
  tags?: readonly ScrapedTag[]
  persons?: readonly ScrapedCharacterPersonFact[]
  photos?: readonly string[]
}

export interface ScrapedGamePersonFact extends ScrapedPersonMetadata {
  role: LibraryGamePersonRole
  isSpoiler?: boolean
  note?: string
}

export interface ScrapedGameCompanyFact extends ScrapedCompanyMetadata {
  role: LibraryGameCompanyRole
  isSpoiler?: boolean
  note?: string
}

export interface ScrapedCharacterPersonFact extends ScrapedPersonMetadata {
  character?: ScrapedCharacterInfo & ScrapedIdentityCarrier
  role: LibraryCharacterPersonRole
  isSpoiler?: boolean
  note?: string
}

export interface ScrapedGameCharacterFact extends ScrapedCharacterMetadata {
  role: LibraryGameCharacterRole
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped media-to-media relation fact.
 *
 * The target is referenced by external identity only; the host resolves it
 * against library entries and never creates media entries for scraped
 * references.
 */
export interface ScrapedRelatedEntryFact {
  mediaType: LibraryMediaType
  source: string
  externalId: string
  type: LibraryMediaRelationType
  note?: string
}

export interface ScrapedAnimePersonFact extends ScrapedPersonMetadata {
  role: LibraryAnimePersonRole
  isSpoiler?: boolean
  note?: string
}

export interface ScrapedAnimeCompanyFact extends ScrapedCompanyMetadata {
  role: LibraryAnimeCompanyRole
  isSpoiler?: boolean
  note?: string
}

export interface ScrapedAnimeCharacterFact extends ScrapedCharacterMetadata {
  role: LibraryAnimeCharacterRole
  isSpoiler?: boolean
  note?: string
}

export interface ScrapedTvPersonFact extends ScrapedPersonMetadata {
  role: LibraryTvPersonRole
  isSpoiler?: boolean
  note?: string
}

export interface ScrapedTvCompanyFact extends ScrapedCompanyMetadata {
  role: LibraryTvCompanyRole
  isSpoiler?: boolean
  note?: string
}

export interface ScrapedTvCharacterFact extends ScrapedCharacterMetadata {
  role: LibraryTvCharacterRole
  isSpoiler?: boolean
  note?: string
}

export interface ScrapedMoviePersonFact extends ScrapedPersonMetadata {
  role: LibraryMoviePersonRole
  isSpoiler?: boolean
  note?: string
}

export interface ScrapedMovieCompanyFact extends ScrapedCompanyMetadata {
  role: LibraryMovieCompanyRole
  isSpoiler?: boolean
  note?: string
}

export interface ScrapedMovieCharacterFact extends ScrapedCharacterMetadata {
  role: LibraryMovieCharacterRole
  isSpoiler?: boolean
  note?: string
}

export interface ScrapedGameBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedGameInfo
  tags?: readonly ScrapedTag[]
  persons?: readonly ScrapedGamePersonFact[]
  companies?: readonly ScrapedGameCompanyFact[]
  characters?: readonly ScrapedGameCharacterFact[]
  relatedEntries?: readonly ScrapedRelatedEntryFact[]
  covers?: readonly string[]
  backdrops?: readonly string[]
  logos?: readonly string[]
  icons?: readonly string[]
}

export interface ScrapedAnimeBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedAnimeInfo
  tags?: readonly ScrapedTag[]
  episodes?: readonly ScrapedAnimeEpisode[]
  persons?: readonly ScrapedAnimePersonFact[]
  companies?: readonly ScrapedAnimeCompanyFact[]
  characters?: readonly ScrapedAnimeCharacterFact[]
  relatedEntries?: readonly ScrapedRelatedEntryFact[]
  covers?: readonly string[]
  backdrops?: readonly string[]
  logos?: readonly string[]
}

export interface ScrapedTvBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedTvInfo
  tags?: readonly ScrapedTag[]
  seasons?: readonly ScrapedTvSeason[]
  episodes?: readonly ScrapedTvEpisode[]
  persons?: readonly ScrapedTvPersonFact[]
  companies?: readonly ScrapedTvCompanyFact[]
  characters?: readonly ScrapedTvCharacterFact[]
  relatedEntries?: readonly ScrapedRelatedEntryFact[]
  covers?: readonly string[]
  backdrops?: readonly string[]
  logos?: readonly string[]
}

export interface ScrapedMovieBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedMovieInfo
  tags?: readonly ScrapedTag[]
  persons?: readonly ScrapedMoviePersonFact[]
  companies?: readonly ScrapedMovieCompanyFact[]
  characters?: readonly ScrapedMovieCharacterFact[]
  relatedEntries?: readonly ScrapedRelatedEntryFact[]
  covers?: readonly string[]
  backdrops?: readonly string[]
  logos?: readonly string[]
}

export interface ScrapedPersonBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedPersonInfo
  tags?: readonly ScrapedTag[]
  photos?: readonly string[]
}

export interface ScrapedCompanyBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedCompanyInfo
  tags?: readonly ScrapedTag[]
  logos?: readonly string[]
}

export interface ScrapedCharacterBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedCharacterInfo
  tags?: readonly ScrapedTag[]
  persons?: readonly ScrapedCharacterPersonFact[]
  photos?: readonly string[]
}

export interface BaseResolvedTarget {
  cacheKey: string
  resolveName?: string
  identity?: ScrapedEntityIdentity
}

export interface IdResolvedTarget extends BaseResolvedTarget {
  id: string
}

export interface BaseScraperSession<
  TSlot extends string,
  TResultMap extends Partial<Record<TSlot, unknown>>
> {
  /**
   * Fetch one or more slots.
   *
   * Slot presence is authoritative: omit a slot the provider cannot answer
   * (unsupported, not found, or failed enrichment), and return an empty
   * collection only when the source states the entity has none. The host treats
   * an omitted slot as unknown and an empty collection as a real emptiness, so
   * it can clear stored data when the user picks the replace policy.
   */
  get(slots: readonly TSlot[]): Promise<ScraperSessionResult<TResultMap>>
  dispose?(): Promise<void>
}

export interface GameSearchResult {
  id: string
  name: string
  originalName?: string
  releaseDate?: PartialDate
  externalIds: readonly ExternalId[]
}

export interface AnimeSearchResult {
  id: string
  name: string
  originalName?: string
  releaseDate?: PartialDate
  format?: LibraryAnimeFormat
  externalIds: readonly ExternalId[]
}

export interface TvSearchResult {
  id: string
  name: string
  originalName?: string
  releaseDate?: PartialDate
  format?: LibraryTvFormat
  externalIds: readonly ExternalId[]
}

export interface MovieSearchResult {
  id: string
  name: string
  originalName?: string
  releaseDate?: PartialDate
  format?: LibraryMovieFormat
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
  relatedEntries: ScrapedRelatedEntryFact[]
  covers: string[]
  backdrops: string[]
  logos: string[]
  icons: string[]
}

export interface AnimeSessionResultMap {
  info: ScrapedAnimeInfo
  tags: ScrapedTag[]
  episodes: ScrapedAnimeEpisode[]
  characters: ScrapedAnimeCharacterFact[]
  persons: ScrapedAnimePersonFact[]
  companies: ScrapedAnimeCompanyFact[]
  relatedEntries: ScrapedRelatedEntryFact[]
  covers: string[]
  backdrops: string[]
  logos: string[]
}

export interface TvSessionResultMap {
  info: ScrapedTvInfo
  tags: ScrapedTag[]
  seasons: ScrapedTvSeason[]
  episodes: ScrapedTvEpisode[]
  characters: ScrapedTvCharacterFact[]
  persons: ScrapedTvPersonFact[]
  companies: ScrapedTvCompanyFact[]
  relatedEntries: ScrapedRelatedEntryFact[]
  covers: string[]
  backdrops: string[]
  logos: string[]
}

export interface MovieSessionResultMap {
  info: ScrapedMovieInfo
  tags: ScrapedTag[]
  characters: ScrapedMovieCharacterFact[]
  persons: ScrapedMoviePersonFact[]
  companies: ScrapedMovieCompanyFact[]
  relatedEntries: ScrapedRelatedEntryFact[]
  covers: string[]
  backdrops: string[]
  logos: string[]
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

export type AnimeScraperSession = BaseScraperSession<AnimeScraperSlot, AnimeSessionResultMap>

export type TvScraperSession = BaseScraperSession<TvScraperSlot, TvSessionResultMap>

export type MovieScraperSession = BaseScraperSession<MovieScraperSlot, MovieSessionResultMap>

export type PersonScraperSession = BaseScraperSession<PersonScraperSlot, PersonSessionResultMap>

export type CompanyScraperSession = BaseScraperSession<CompanyScraperSlot, CompanySessionResultMap>

export type CharacterScraperSession = BaseScraperSession<
  CharacterScraperSlot,
  CharacterSessionResultMap
>

export interface BaseScraperProvider<TSlot extends ScraperSlot = ScraperSlot> {
  /** Unique within the media-specific registrar used to register this provider. */
  readonly id: string
  readonly name: string
  readonly externalIdSource: string
  readonly capabilities: readonly ScraperCapability<TSlot>[]
}

export interface GameScraperProvider extends BaseScraperProvider<GameScraperSlot> {
  search(query: string, ctx: ScraperProviderContext): Promise<readonly GameSearchResult[]>
  resolve(lookup: GameScraperLookup, ctx: ScraperProviderContext): Promise<IdResolvedTarget | null>
  openSession(target: IdResolvedTarget, ctx: ScraperProviderContext): Promise<GameScraperSession>
}

export interface AnimeScraperProvider extends BaseScraperProvider<AnimeScraperSlot> {
  search(query: string, ctx: ScraperProviderContext): Promise<readonly AnimeSearchResult[]>
  resolve(lookup: AnimeScraperLookup, ctx: ScraperProviderContext): Promise<IdResolvedTarget | null>
  openSession(target: IdResolvedTarget, ctx: ScraperProviderContext): Promise<AnimeScraperSession>
}

export interface TvScraperProvider extends BaseScraperProvider<TvScraperSlot> {
  search(query: string, ctx: ScraperProviderContext): Promise<readonly TvSearchResult[]>
  resolve(lookup: TvScraperLookup, ctx: ScraperProviderContext): Promise<IdResolvedTarget | null>
  openSession(target: IdResolvedTarget, ctx: ScraperProviderContext): Promise<TvScraperSession>
}

export interface MovieScraperProvider extends BaseScraperProvider<MovieScraperSlot> {
  search(query: string, ctx: ScraperProviderContext): Promise<readonly MovieSearchResult[]>
  resolve(lookup: MovieScraperLookup, ctx: ScraperProviderContext): Promise<IdResolvedTarget | null>
  openSession(target: IdResolvedTarget, ctx: ScraperProviderContext): Promise<MovieScraperSession>
}

export interface PersonScraperProvider extends BaseScraperProvider<PersonScraperSlot> {
  search(query: string, ctx: ScraperProviderContext): Promise<readonly PersonSearchResult[]>
  resolve(lookup: ScraperLookup, ctx: ScraperProviderContext): Promise<IdResolvedTarget | null>
  openSession(target: IdResolvedTarget, ctx: ScraperProviderContext): Promise<PersonScraperSession>
}

export interface CompanyScraperProvider extends BaseScraperProvider<CompanyScraperSlot> {
  search(query: string, ctx: ScraperProviderContext): Promise<readonly CompanySearchResult[]>
  resolve(lookup: ScraperLookup, ctx: ScraperProviderContext): Promise<IdResolvedTarget | null>
  openSession(target: IdResolvedTarget, ctx: ScraperProviderContext): Promise<CompanyScraperSession>
}

export interface CharacterScraperProvider extends BaseScraperProvider<CharacterScraperSlot> {
  search(query: string, ctx: ScraperProviderContext): Promise<readonly CharacterSearchResult[]>
  resolve(lookup: ScraperLookup, ctx: ScraperProviderContext): Promise<IdResolvedTarget | null>
  openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<CharacterScraperSession>
}

export type ScraperProviderRegistration = Disposable

export interface ScraperProviderRegistrationPoint<TProvider extends BaseScraperProvider> {
  register(provider: TProvider): ScraperProviderRegistration
}

export interface ScraperProviderRegistrar {
  readonly game: ScraperProviderRegistrationPoint<GameScraperProvider>
  readonly anime: ScraperProviderRegistrationPoint<AnimeScraperProvider>
  readonly tv: ScraperProviderRegistrationPoint<TvScraperProvider>
  readonly movie: ScraperProviderRegistrationPoint<MovieScraperProvider>
  readonly person: ScraperProviderRegistrationPoint<PersonScraperProvider>
  readonly company: ScraperProviderRegistrationPoint<CompanyScraperProvider>
  readonly character: ScraperProviderRegistrationPoint<CharacterScraperProvider>
}
