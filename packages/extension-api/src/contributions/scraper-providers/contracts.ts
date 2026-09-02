import type { Disposable, ExternalId, ContentLocale, PartialDate, ExternalSite } from '../../shared'
import type {
  LibraryAnimeCharacterRole,
  LibraryAnimeCompanyRole,
  LibraryAnimeEpisodeType,
  LibraryAnimeFormat,
  LibraryAnimePersonRole,
  LibraryBloodType,
  LibraryCharacterPersonRole,
  LibraryComicCharacterRole,
  LibraryComicCompanyRole,
  LibraryComicFormat,
  LibraryComicPersonRole,
  LibraryCupSize,
  LibraryGameCharacterRole,
  LibraryGameCompanyRole,
  LibraryGamePersonRole,
  LibraryGender,
  LibraryMediaRelationType,
  LibraryNovelCharacterRole,
  LibraryNovelCompanyRole,
  LibraryNovelFormat,
  LibraryNovelPersonRole
} from '../../shared/library'
import type { LibraryMediaType } from '../../capabilities/library/graph'

export const SCRAPER_ENTITY_TYPES = [
  'game',
  'anime',
  'comic',
  'novel',
  'person',
  'company',
  'character'
] as const

export type ScraperEntityType = (typeof SCRAPER_ENTITY_TYPES)[number]

/**
 * Layer a search result sits at, when the provider states one.
 *
 * Sources that publish a work and each of its volumes as separate searchable
 * entries return them side by side, and only the work is a library entry. Omit
 * the fact when the source has one grain: a silent result must not read as a
 * volume.
 */
export const MEDIA_ENTRY_GRAINS = ['work', 'volume'] as const

export type MediaEntryGrain = (typeof MEDIA_ENTRY_GRAINS)[number]

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

export const COMIC_SCRAPER_SLOTS = [
  'info',
  'tags',
  'chapters',
  'characters',
  'persons',
  'companies',
  'relatedEntries',
  'covers',
  'backdrops',
  'logos'
] as const

export type ComicScraperSlot = (typeof COMIC_SCRAPER_SLOTS)[number]

export const NOVEL_SCRAPER_SLOTS = [
  'info',
  'tags',
  'volumes',
  'characters',
  'persons',
  'companies',
  'relatedEntries',
  'covers',
  'backdrops',
  'logos'
] as const

export type NovelScraperSlot = (typeof NOVEL_SCRAPER_SLOTS)[number]

export const PERSON_SCRAPER_SLOTS = ['info', 'tags', 'photos'] as const

export type PersonScraperSlot = (typeof PERSON_SCRAPER_SLOTS)[number]

export const COMPANY_SCRAPER_SLOTS = ['info', 'tags', 'logos'] as const

export type CompanyScraperSlot = (typeof COMPANY_SCRAPER_SLOTS)[number]

export const CHARACTER_SCRAPER_SLOTS = ['info', 'tags', 'persons', 'photos'] as const

export type CharacterScraperSlot = (typeof CHARACTER_SCRAPER_SLOTS)[number]

export type ScraperSlot =
  | GameScraperSlot
  | AnimeScraperSlot
  | ComicScraperSlot
  | NovelScraperSlot
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
  locale?: ContentLocale | undefined
  knownIds?: readonly ExternalId[] | undefined
}

/**
 * Lookup for a media entry.
 *
 * The facts only matter to a name search, where one work spans many provider
 * entries: a visual novel and its fandisc, or a series and its OVA, share a
 * name. They are hints, never overrides — a provider that can identify the
 * entry by id ignores them — and any of them may be absent, so a provider must
 * still answer without them.
 */
export interface MediaScraperLookup extends ScraperLookup {
  /** Release date of the entry, as precise as the host knows it. */
  releaseDate?: PartialDate | undefined
}

/** Lookup for an anime entry, adding its release format to the media facts. */
export interface AnimeScraperLookup extends MediaScraperLookup {
  format?: LibraryAnimeFormat | undefined
}

/** Lookup for a comic entry, adding its release format to the media facts. */
export interface ComicScraperLookup extends MediaScraperLookup {
  format?: LibraryComicFormat | undefined
}

/** Lookup for a novel entry, adding its release format to the media facts. */
export interface NovelScraperLookup extends MediaScraperLookup {
  format?: LibraryNovelFormat | undefined
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
  identity?: ScrapedEntityIdentity | undefined
  slots: Partial<TResultMap>
}

export interface ScrapedTag {
  name: string
  isSpoiler?: boolean | undefined
  note?: string | undefined
  isNsfw?: boolean | undefined
}

export interface ScrapedGameInfo {
  name: string
  originalName?: string | undefined
  /** Other titles this entry is known by, such as localized names and abbreviations. */
  aliases?: readonly string[] | undefined
  releaseDate?: PartialDate | undefined
  description?: string | undefined
  externalSites?: readonly ExternalSite[] | undefined
}

export interface ScrapedAnimeInfo {
  name: string
  originalName?: string | undefined
  /** Other titles this entry is known by, such as localized names and abbreviations. */
  aliases?: readonly string[] | undefined
  releaseDate?: PartialDate | undefined
  description?: string | undefined
  format?: LibraryAnimeFormat | undefined
  /** Episode count declared by the source; episode rows stay authoritative. */
  totalEpisodes?: number | undefined
  externalSites?: readonly ExternalSite[] | undefined
}

export interface ScrapedComicInfo {
  name: string
  originalName?: string | undefined
  /** Other titles this entry is known by, such as localized names and abbreviations. */
  aliases?: readonly string[] | undefined
  releaseDate?: PartialDate | undefined
  description?: string | undefined
  format?: LibraryComicFormat | undefined
  /** Volume count declared by the source; unit rows stay authoritative. */
  totalVolumes?: number | undefined
  /** Chapter count declared by the source; unit rows stay authoritative. */
  totalChapters?: number | undefined
  externalSites?: readonly ExternalSite[] | undefined
}

/**
 * One readable unit of a comic entry, at either grain: a collected volume
 * carries `volumeNumber`, a serialized chapter carries `chapterNumber` (plus
 * its volume when known).
 *
 * `externalIds` carries per-unit identity so re-scrapes realign existing rows
 * by id rather than by number, which sources revise.
 */
export interface ScrapedComicChapter {
  volumeNumber?: number | undefined
  chapterNumber?: number | undefined
  name?: string | undefined
  originalName?: string | undefined
  releaseDate?: PartialDate | undefined
  description?: string | undefined
  /** Cover art of this installment (tankobon art), not a page render. */
  coverUrl?: string | undefined
  externalIds?: readonly ExternalId[] | undefined
}

export interface ScrapedNovelInfo {
  name: string
  originalName?: string | undefined
  /** Other titles this entry is known by, such as localized names and abbreviations. */
  aliases?: readonly string[] | undefined
  releaseDate?: PartialDate | undefined
  description?: string | undefined
  format?: LibraryNovelFormat | undefined
  /** Volume count declared by the source; volume rows stay authoritative. */
  totalVolumes?: number | undefined
  externalSites?: readonly ExternalSite[] | undefined
}

/**
 * One volume of a novel entry.
 *
 * `externalIds` carries per-volume identity so re-scrapes realign existing
 * rows by id rather than by number, which sources revise.
 */
export interface ScrapedNovelVolume {
  volumeNumber?: number | undefined
  name?: string | undefined
  originalName?: string | undefined
  releaseDate?: PartialDate | undefined
  description?: string | undefined
  /** Cover art of this volume, not a page render. */
  coverUrl?: string | undefined
  externalIds?: readonly ExternalId[] | undefined
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
  name?: string | undefined
  originalName?: string | undefined
  airDate?: PartialDate | undefined
  description?: string | undefined
  durationMs?: number | undefined
  /** Still frame of this episode from metadata, not a render of the local file. */
  stillUrl?: string | undefined
  externalIds?: readonly ExternalId[] | undefined
}

export interface ScrapedPersonInfo {
  name: string
  originalName?: string | undefined
  /** Other names this person is credited under, such as pen names. */
  aliases?: readonly string[] | undefined
  birthDate?: PartialDate | undefined
  deathDate?: PartialDate | undefined
  gender?: LibraryGender | undefined
  description?: string | undefined
  externalSites?: readonly ExternalSite[] | undefined
}

export interface ScrapedCompanyInfo {
  name: string
  originalName?: string | undefined
  foundedDate?: PartialDate | undefined
  description?: string | undefined
  externalSites?: readonly ExternalSite[] | undefined
}

export interface ScrapedCharacterInfo {
  name: string
  originalName?: string | undefined
  /** Nicknames and romanizations this character is also known by. */
  aliases?: readonly string[] | undefined
  birthDate?: PartialDate | undefined
  gender?: LibraryGender | undefined
  age?: number | undefined
  bloodType?: LibraryBloodType | undefined
  height?: number | undefined
  weight?: number | undefined
  bust?: number | undefined
  waist?: number | undefined
  hips?: number | undefined
  cup?: LibraryCupSize | undefined
  description?: string | undefined
  externalSites?: readonly ExternalSite[] | undefined
}

export interface ScrapedPersonMetadata extends ScrapedPersonInfo, ScrapedIdentityCarrier {
  tags?: readonly ScrapedTag[] | undefined
  photos?: readonly string[] | undefined
}

export interface ScrapedCompanyMetadata extends ScrapedCompanyInfo, ScrapedIdentityCarrier {
  tags?: readonly ScrapedTag[] | undefined
  logos?: readonly string[] | undefined
}

export interface ScrapedCharacterMetadata extends ScrapedCharacterInfo, ScrapedIdentityCarrier {
  tags?: readonly ScrapedTag[] | undefined
  persons?: readonly ScrapedCharacterPersonFact[] | undefined
  photos?: readonly string[] | undefined
}

export interface ScrapedGamePersonFact extends ScrapedPersonMetadata {
  role: LibraryGamePersonRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

export interface ScrapedGameCompanyFact extends ScrapedCompanyMetadata {
  role: LibraryGameCompanyRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

/**
 * What a person is to a character, as one source states it.
 *
 * A fact with `role: 'actor'` nested in a media entry's character fact is also
 * that entry's voice credit: the host writes it to the entry's cast alongside
 * the work-independent character-person row.
 */
export interface ScrapedCharacterPersonFact extends ScrapedPersonMetadata {
  character?: (ScrapedCharacterInfo & ScrapedIdentityCarrier) | undefined
  role: LibraryCharacterPersonRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

export interface ScrapedGameCharacterFact extends ScrapedCharacterMetadata {
  role: LibraryGameCharacterRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
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
  note?: string | undefined
}

export interface ScrapedAnimePersonFact extends ScrapedPersonMetadata {
  role: LibraryAnimePersonRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

export interface ScrapedAnimeCompanyFact extends ScrapedCompanyMetadata {
  role: LibraryAnimeCompanyRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

export interface ScrapedAnimeCharacterFact extends ScrapedCharacterMetadata {
  role: LibraryAnimeCharacterRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

export interface ScrapedComicPersonFact extends ScrapedPersonMetadata {
  role: LibraryComicPersonRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

export interface ScrapedComicCompanyFact extends ScrapedCompanyMetadata {
  role: LibraryComicCompanyRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

export interface ScrapedComicCharacterFact extends ScrapedCharacterMetadata {
  role: LibraryComicCharacterRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

export interface ScrapedNovelPersonFact extends ScrapedPersonMetadata {
  role: LibraryNovelPersonRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

export interface ScrapedNovelCompanyFact extends ScrapedCompanyMetadata {
  role: LibraryNovelCompanyRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

export interface ScrapedNovelCharacterFact extends ScrapedCharacterMetadata {
  role: LibraryNovelCharacterRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

export interface ScrapedGameBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedGameInfo | undefined
  tags?: readonly ScrapedTag[] | undefined
  persons?: readonly ScrapedGamePersonFact[] | undefined
  companies?: readonly ScrapedGameCompanyFact[] | undefined
  characters?: readonly ScrapedGameCharacterFact[] | undefined
  relatedEntries?: readonly ScrapedRelatedEntryFact[] | undefined
  covers?: readonly string[] | undefined
  backdrops?: readonly string[] | undefined
  logos?: readonly string[] | undefined
  icons?: readonly string[] | undefined
}

export interface ScrapedAnimeBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedAnimeInfo | undefined
  tags?: readonly ScrapedTag[] | undefined
  episodes?: readonly ScrapedAnimeEpisode[] | undefined
  persons?: readonly ScrapedAnimePersonFact[] | undefined
  companies?: readonly ScrapedAnimeCompanyFact[] | undefined
  characters?: readonly ScrapedAnimeCharacterFact[] | undefined
  relatedEntries?: readonly ScrapedRelatedEntryFact[] | undefined
  covers?: readonly string[] | undefined
  backdrops?: readonly string[] | undefined
  logos?: readonly string[] | undefined
}

export interface ScrapedComicBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedComicInfo | undefined
  tags?: readonly ScrapedTag[] | undefined
  chapters?: readonly ScrapedComicChapter[] | undefined
  persons?: readonly ScrapedComicPersonFact[] | undefined
  companies?: readonly ScrapedComicCompanyFact[] | undefined
  characters?: readonly ScrapedComicCharacterFact[] | undefined
  relatedEntries?: readonly ScrapedRelatedEntryFact[] | undefined
  covers?: readonly string[] | undefined
  backdrops?: readonly string[] | undefined
  logos?: readonly string[] | undefined
}

export interface ScrapedNovelBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedNovelInfo | undefined
  tags?: readonly ScrapedTag[] | undefined
  volumes?: readonly ScrapedNovelVolume[] | undefined
  persons?: readonly ScrapedNovelPersonFact[] | undefined
  companies?: readonly ScrapedNovelCompanyFact[] | undefined
  characters?: readonly ScrapedNovelCharacterFact[] | undefined
  relatedEntries?: readonly ScrapedRelatedEntryFact[] | undefined
  covers?: readonly string[] | undefined
  backdrops?: readonly string[] | undefined
  logos?: readonly string[] | undefined
}

export interface ScrapedPersonBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedPersonInfo | undefined
  tags?: readonly ScrapedTag[] | undefined
  photos?: readonly string[] | undefined
}

export interface ScrapedCompanyBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedCompanyInfo | undefined
  tags?: readonly ScrapedTag[] | undefined
  logos?: readonly string[] | undefined
}

export interface ScrapedCharacterBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedCharacterInfo | undefined
  tags?: readonly ScrapedTag[] | undefined
  persons?: readonly ScrapedCharacterPersonFact[] | undefined
  photos?: readonly string[] | undefined
}

export interface BaseResolvedTarget {
  cacheKey: string
  resolveName?: string | undefined
  identity?: ScrapedEntityIdentity | undefined
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
  originalName?: string | undefined
  releaseDate?: PartialDate | undefined
  externalIds: readonly ExternalId[]
}

export interface AnimeSearchResult {
  id: string
  name: string
  originalName?: string | undefined
  releaseDate?: PartialDate | undefined
  format?: LibraryAnimeFormat | undefined
  externalIds: readonly ExternalId[]
}

export interface ComicSearchResult {
  id: string
  name: string
  originalName?: string | undefined
  releaseDate?: PartialDate | undefined
  format?: LibraryComicFormat | undefined
  /** Layer this row sits at, for sources that list works and volumes together. */
  grain?: MediaEntryGrain | undefined
  externalIds: readonly ExternalId[]
}

export interface NovelSearchResult {
  id: string
  name: string
  originalName?: string | undefined
  releaseDate?: PartialDate | undefined
  format?: LibraryNovelFormat | undefined
  /** Layer this row sits at, for sources that list works and volumes together. */
  grain?: MediaEntryGrain | undefined
  externalIds: readonly ExternalId[]
}

export interface PersonSearchResult {
  id: string
  name: string
  originalName?: string | undefined
  birthDate?: PartialDate | undefined
  deathDate?: PartialDate | undefined
  externalIds: readonly ExternalId[]
}

export interface CompanySearchResult {
  id: string
  name: string
  originalName?: string | undefined
  foundedDate?: PartialDate | undefined
  externalIds: readonly ExternalId[]
}

export interface CharacterSearchResult {
  id: string
  name: string
  originalName?: string | undefined
  birthDate?: PartialDate | undefined
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

export interface ComicSessionResultMap {
  info: ScrapedComicInfo
  tags: ScrapedTag[]
  chapters: ScrapedComicChapter[]
  characters: ScrapedComicCharacterFact[]
  persons: ScrapedComicPersonFact[]
  companies: ScrapedComicCompanyFact[]
  relatedEntries: ScrapedRelatedEntryFact[]
  covers: string[]
  backdrops: string[]
  logos: string[]
}

export interface NovelSessionResultMap {
  info: ScrapedNovelInfo
  tags: ScrapedTag[]
  volumes: ScrapedNovelVolume[]
  characters: ScrapedNovelCharacterFact[]
  persons: ScrapedNovelPersonFact[]
  companies: ScrapedNovelCompanyFact[]
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

export type ComicScraperSession = BaseScraperSession<ComicScraperSlot, ComicSessionResultMap>

export type NovelScraperSession = BaseScraperSession<NovelScraperSlot, NovelSessionResultMap>

export type PersonScraperSession = BaseScraperSession<PersonScraperSlot, PersonSessionResultMap>

export type CompanyScraperSession = BaseScraperSession<CompanyScraperSlot, CompanySessionResultMap>

export type CharacterScraperSession = BaseScraperSession<
  CharacterScraperSlot,
  CharacterSessionResultMap
>

/**
 * Static declaration every scraper provider carries.
 *
 * `capabilities` is the single source of truth for what the provider answers:
 * a provider implements `search` if and only if it declares the `search`
 * capability. A provider without it can still fill slots — it is reached
 * through `knownIds` in the lookup rather than by name — which is the normal
 * shape for sources whose satellite entities (persons, companies, characters)
 * are only addressable by id.
 */
export interface BaseScraperProvider<TSlot extends ScraperSlot = ScraperSlot> {
  /** Unique within the media-specific registrar used to register this provider. */
  readonly id: string
  readonly name: string
  readonly externalIdSource: string
  readonly capabilities: readonly ScraperCapability<TSlot>[]
}

export interface GameScraperProvider extends BaseScraperProvider<GameScraperSlot> {
  search?(query: string, ctx: ScraperProviderContext): Promise<readonly GameSearchResult[]>
  resolve(lookup: GameScraperLookup, ctx: ScraperProviderContext): Promise<IdResolvedTarget | null>
  openSession(target: IdResolvedTarget, ctx: ScraperProviderContext): Promise<GameScraperSession>
}

export interface AnimeScraperProvider extends BaseScraperProvider<AnimeScraperSlot> {
  search?(query: string, ctx: ScraperProviderContext): Promise<readonly AnimeSearchResult[]>
  resolve(lookup: AnimeScraperLookup, ctx: ScraperProviderContext): Promise<IdResolvedTarget | null>
  openSession(target: IdResolvedTarget, ctx: ScraperProviderContext): Promise<AnimeScraperSession>
}

export interface ComicScraperProvider extends BaseScraperProvider<ComicScraperSlot> {
  search?(query: string, ctx: ScraperProviderContext): Promise<readonly ComicSearchResult[]>
  resolve(lookup: ComicScraperLookup, ctx: ScraperProviderContext): Promise<IdResolvedTarget | null>
  openSession(target: IdResolvedTarget, ctx: ScraperProviderContext): Promise<ComicScraperSession>
}

export interface NovelScraperProvider extends BaseScraperProvider<NovelScraperSlot> {
  search?(query: string, ctx: ScraperProviderContext): Promise<readonly NovelSearchResult[]>
  resolve(lookup: NovelScraperLookup, ctx: ScraperProviderContext): Promise<IdResolvedTarget | null>
  openSession(target: IdResolvedTarget, ctx: ScraperProviderContext): Promise<NovelScraperSession>
}

export interface PersonScraperProvider extends BaseScraperProvider<PersonScraperSlot> {
  search?(query: string, ctx: ScraperProviderContext): Promise<readonly PersonSearchResult[]>
  resolve(lookup: ScraperLookup, ctx: ScraperProviderContext): Promise<IdResolvedTarget | null>
  openSession(target: IdResolvedTarget, ctx: ScraperProviderContext): Promise<PersonScraperSession>
}

export interface CompanyScraperProvider extends BaseScraperProvider<CompanyScraperSlot> {
  search?(query: string, ctx: ScraperProviderContext): Promise<readonly CompanySearchResult[]>
  resolve(lookup: ScraperLookup, ctx: ScraperProviderContext): Promise<IdResolvedTarget | null>
  openSession(target: IdResolvedTarget, ctx: ScraperProviderContext): Promise<CompanyScraperSession>
}

export interface CharacterScraperProvider extends BaseScraperProvider<CharacterScraperSlot> {
  search?(query: string, ctx: ScraperProviderContext): Promise<readonly CharacterSearchResult[]>
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
  readonly comic: ScraperProviderRegistrationPoint<ComicScraperProvider>
  readonly novel: ScraperProviderRegistrationPoint<NovelScraperProvider>
  readonly person: ScraperProviderRegistrationPoint<PersonScraperProvider>
  readonly company: ScraperProviderRegistrationPoint<CompanyScraperProvider>
  readonly character: ScraperProviderRegistrationPoint<CharacterScraperProvider>
}
