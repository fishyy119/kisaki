import type {
  AnimeUpdateCoreSurface,
  AnimeUpdateMediaSurface,
  AnimeUpdateRelationSurface,
  AnimeUpdateSurface,
  CharacterUpdateCoreSurface,
  CharacterUpdateMediaSurface,
  CharacterUpdateRelationSurface,
  CharacterUpdateSurface,
  ComicUpdateCoreSurface,
  ComicUpdateMediaSurface,
  ComicUpdateRelationSurface,
  ComicUpdateSurface,
  CompanyUpdateCoreSurface,
  CompanyUpdateMediaSurface,
  CompanyUpdateRelationSurface,
  CompanyUpdateSurface,
  GameUpdateCoreSurface,
  GameUpdateMediaSurface,
  GameUpdateRelationSurface,
  GameUpdateSurface,
  IngestUpdatePolicy,
  NovelUpdateCoreSurface,
  NovelUpdateMediaSurface,
  NovelUpdateRelationSurface,
  NovelUpdateSurface,
  PersonUpdateCoreSurface,
  PersonUpdateMediaSurface,
  PersonUpdateRelationSurface,
  PersonUpdateSurface
} from '@shared/ingest/update'
import type { ExternalId } from '@shared/identity'
import type {
  ScrapedAnimeRelationFacts,
  ScrapedCharacterRelationFacts,
  ScrapedComicRelationFacts,
  ScrapedGameRelationFacts,
  ScrapedNovelRelationFacts,
  ScrapedRelatedEntryFact
} from '@shared/scraper'
import type { PendingAssetTask } from '../assets'
import type {
  IngestAnimeGraph,
  IngestAnimeGraphLinks,
  IngestCharacterGraph,
  IngestComicGraph,
  IngestComicGraphLinks,
  IngestGameGraph,
  IngestGameGraphLinks,
  IngestNovelGraph,
  IngestNovelGraphLinks
} from '../graph'
import type {
  AnimeEpisodeInfo,
  ComicChapterInfo,
  CoreAnimeMetadata,
  CoreCharacterMetadata,
  CoreComicMetadata,
  CoreCompanyMetadata,
  CoreGameMetadata,
  CoreNovelMetadata,
  CorePersonMetadata,
  NovelVolumeInfo,
  Tag
} from '@shared/metadata'
import type { Anime, Character, Comic, Company, Game, Novel, Person } from '@shared/db'

export interface UpdateIncomingBundle<TCore, TRelationFacts, TMediaCandidates> {
  core: Partial<TCore>
  relationFacts: Partial<TRelationFacts>
  mediaCandidates: Partial<TMediaCandidates>
}

/** How a collection write target reconciles incoming values with stored ones. */
export type CollectionUpdateMode = IngestUpdatePolicy['collectionUpdate']

/** Surfaces the scraper answered at all; only these may be applied. */
export interface UpdateIncomingAvailability<TSurface extends string> {
  surfaces: Set<TSurface>
}

/**
 * Availability for entities that write relation link tables.
 *
 * A link table can be fed by several fact sources, so "may be written" and "may
 * be cleared" are different questions: writing needs one answer, while clearing
 * needs every source to have answered.
 */
export interface UpdateIncomingRelationAvailability<
  TSurface extends string,
  TLinkKind extends string
> extends UpdateIncomingAvailability<TSurface> {
  /** Link tables whose every fact source answered; only these may be cleared. */
  completeLinks: Set<TLinkKind>
}

export interface UpdateIncomingBuildResult<TAvailability, TCore, TRelationFacts, TMediaCandidates> {
  incoming: UpdateIncomingBundle<TCore, TRelationFacts, TMediaCandidates>
  availability: TAvailability
}

/**
 * Link tables a game update can write.
 *
 * Derived from the graph builder's output, so a new link table forces a
 * declaration in `GAME_LINK_TOPOLOGY`.
 */
export type GameLinkKind = keyof IngestGameGraphLinks

/**
 * Link tables an anime update can write.
 *
 * Derived from the graph builder's output, so a new link table forces a
 * declaration in `ANIME_LINK_TOPOLOGY`.
 */
export type AnimeLinkKind = keyof IngestAnimeGraphLinks

/**
 * Link tables a comic update can write.
 *
 * Derived from the graph builder's output, so a new link table forces a
 * declaration in `COMIC_LINK_TOPOLOGY`.
 */
export type ComicLinkKind = keyof IngestComicGraphLinks

/**
 * Link tables a novel update can write.
 *
 * Derived from the graph builder's output, so a new link table forces a
 * declaration in `NOVEL_LINK_TOPOLOGY`.
 */
export type NovelLinkKind = keyof IngestNovelGraphLinks

/** Link tables a character update can write; the graph carries a single set. */
export type CharacterLinkKind = 'characterPerson'

export interface PersonIncomingMediaCandidates {
  photoUrls?: string[]
}

export interface CompanyIncomingMediaCandidates {
  logoUrls?: string[]
}

export interface CharacterIncomingMediaCandidates {
  photoUrls?: string[]
}

export interface GameIncomingMediaCandidates {
  coverUrls?: string[]
  backdropUrls?: string[]
  logoUrls?: string[]
  iconUrls?: string[]
}

export interface AnimeIncomingMediaCandidates {
  coverUrls?: string[]
  backdropUrls?: string[]
  logoUrls?: string[]
}

export interface ComicIncomingMediaCandidates {
  coverUrls?: string[]
  backdropUrls?: string[]
  logoUrls?: string[]
}

export interface NovelIncomingMediaCandidates {
  coverUrls?: string[]
  backdropUrls?: string[]
  logoUrls?: string[]
}

export type PersonIncomingBuildResult = UpdateIncomingBuildResult<
  UpdateIncomingAvailability<PersonUpdateSurface>,
  CorePersonMetadata,
  Record<never, never>,
  PersonIncomingMediaCandidates
>

export type CompanyIncomingBuildResult = UpdateIncomingBuildResult<
  UpdateIncomingAvailability<CompanyUpdateSurface>,
  CoreCompanyMetadata,
  Record<never, never>,
  CompanyIncomingMediaCandidates
>

export type CharacterIncomingBuildResult = UpdateIncomingBuildResult<
  UpdateIncomingRelationAvailability<CharacterUpdateSurface, CharacterLinkKind>,
  CoreCharacterMetadata,
  ScrapedCharacterRelationFacts,
  CharacterIncomingMediaCandidates
>

export type GameIncomingBuildResult = UpdateIncomingBuildResult<
  UpdateIncomingRelationAvailability<GameUpdateSurface, GameLinkKind>,
  CoreGameMetadata,
  ScrapedGameRelationFacts,
  GameIncomingMediaCandidates
>

export interface AnimeIncomingBuildResult extends UpdateIncomingBuildResult<
  UpdateIncomingRelationAvailability<AnimeUpdateSurface, AnimeLinkKind>,
  CoreAnimeMetadata,
  ScrapedAnimeRelationFacts,
  AnimeIncomingMediaCandidates
> {
  /** Absent means the scrape could not answer episodes; an empty array means none exist. */
  episodes?: AnimeEpisodeInfo[]
}

export interface ComicIncomingBuildResult extends UpdateIncomingBuildResult<
  UpdateIncomingRelationAvailability<ComicUpdateSurface, ComicLinkKind>,
  CoreComicMetadata,
  ScrapedComicRelationFacts,
  ComicIncomingMediaCandidates
> {
  /** Absent means the scrape could not answer units; an empty array means none exist. */
  chapters?: ComicChapterInfo[]
}

export interface NovelIncomingBuildResult extends UpdateIncomingBuildResult<
  UpdateIncomingRelationAvailability<NovelUpdateSurface, NovelLinkKind>,
  CoreNovelMetadata,
  ScrapedNovelRelationFacts,
  NovelIncomingMediaCandidates
> {
  /** Absent means the scrape could not answer volumes; an empty array means none exist. */
  volumes?: NovelVolumeInfo[]
}

export interface PersonCurrentState {
  person: Person
  externalIds: ExternalId[]
  tags: Tag[]
}

export interface CompanyCurrentState {
  company: Company
  externalIds: ExternalId[]
  tags: Tag[]
}

export interface CharacterCurrentState {
  character: Character
  externalIds: ExternalId[]
  tags: Tag[]
}

export interface GameCurrentState {
  game: Game
  externalIds: ExternalId[]
  tags: Tag[]
}

export interface AnimeCurrentState {
  anime: Anime
  externalIds: ExternalId[]
  tags: Tag[]
}

export interface ComicCurrentState {
  comic: Comic
  externalIds: ExternalId[]
  tags: Tag[]
}

export interface NovelCurrentState {
  novel: Novel
  externalIds: ExternalId[]
  tags: Tag[]
}

export interface PersonUpdatePlan {
  patch: Partial<Person>
  externalIds?: ExternalId[]
  tags?: Tag[]
  photoUrl?: string
}

export interface CompanyUpdatePlan {
  patch: Partial<Company>
  externalIds?: ExternalId[]
  tags?: Tag[]
  logoUrl?: string
}

export interface CharacterUpdatePlan {
  patch: Partial<Character>
  externalIds?: ExternalId[]
  tags?: Tag[]
  photoUrl?: string
  /** Link tables to write, each with the mode resolved for that table. */
  links: Partial<Record<CharacterLinkKind, CollectionUpdateMode>>
  /** Link tables where `replace` was downgraded because a fact source stayed silent. */
  degradedLinks: CharacterLinkKind[]
  relationGraph?: IngestCharacterGraph
}

export interface GameUpdatePlan {
  patch: Partial<Game>
  externalIds?: ExternalId[]
  tags?: Tag[]
  coverUrl?: string
  backdropUrl?: string
  logoUrl?: string
  iconUrl?: string
  /** Link tables to write, each with the mode resolved for that table. */
  links: Partial<Record<GameLinkKind, CollectionUpdateMode>>
  /** Link tables where `replace` was downgraded because a fact source stayed silent. */
  degradedLinks: GameLinkKind[]
  relationGraph?: IngestGameGraph
  relatedEntries?: RelatedEntriesUpdatePlan
}

/**
 * Episode write resolved for one update.
 *
 * Present only when the episodes surface was selected and the scrape answered
 * it; `items` may then be an authoritative empty list. `mode` decides whether
 * stored rows absent from `items` may be deleted (`replace`) or must be kept
 * (`merge`).
 */
export interface AnimeEpisodeUpdatePlan {
  items: AnimeEpisodeInfo[]
  mode: CollectionUpdateMode
}

/**
 * Related-entry write resolved for one update. A single fact source feeds the
 * table, so an answered slot is always complete and `replace` never degrades.
 */
export interface RelatedEntriesUpdatePlan {
  facts: ScrapedRelatedEntryFact[]
  mode: CollectionUpdateMode
}

export interface AnimeUpdatePlan {
  patch: Partial<Anime>
  externalIds?: ExternalId[]
  tags?: Tag[]
  coverUrl?: string
  backdropUrl?: string
  logoUrl?: string
  episodes?: AnimeEpisodeUpdatePlan
  /** Link tables to write, each with the mode resolved for that table. */
  links: Partial<Record<AnimeLinkKind, CollectionUpdateMode>>
  /** Link tables where `replace` was downgraded because a fact source stayed silent. */
  degradedLinks: AnimeLinkKind[]
  relationGraph?: IngestAnimeGraph
  relatedEntries?: RelatedEntriesUpdatePlan
}

/** Unit write resolved for one comic update; see `AnimeEpisodeUpdatePlan`. */
export interface ComicChapterUpdatePlan {
  items: ComicChapterInfo[]
  mode: CollectionUpdateMode
}

export interface ComicUpdatePlan {
  patch: Partial<Comic>
  externalIds?: ExternalId[]
  tags?: Tag[]
  coverUrl?: string
  backdropUrl?: string
  logoUrl?: string
  chapters?: ComicChapterUpdatePlan
  /** Link tables to write, each with the mode resolved for that table. */
  links: Partial<Record<ComicLinkKind, CollectionUpdateMode>>
  /** Link tables where `replace` was downgraded because a fact source stayed silent. */
  degradedLinks: ComicLinkKind[]
  relationGraph?: IngestComicGraph
  relatedEntries?: RelatedEntriesUpdatePlan
}

/** Volume write resolved for one novel update; see `AnimeEpisodeUpdatePlan`. */
export interface NovelVolumeUpdatePlan {
  items: NovelVolumeInfo[]
  mode: CollectionUpdateMode
}

export interface NovelUpdatePlan {
  patch: Partial<Novel>
  externalIds?: ExternalId[]
  tags?: Tag[]
  coverUrl?: string
  backdropUrl?: string
  logoUrl?: string
  volumes?: NovelVolumeUpdatePlan
  /** Link tables to write, each with the mode resolved for that table. */
  links: Partial<Record<NovelLinkKind, CollectionUpdateMode>>
  /** Link tables where `replace` was downgraded because a fact source stayed silent. */
  degradedLinks: NovelLinkKind[]
  relationGraph?: IngestNovelGraph
  relatedEntries?: RelatedEntriesUpdatePlan
}

export interface UpdateApplyResult {
  pendingAssets: PendingAssetTask[]
}

export interface UpdateLinkApplyResult<TLinkKind extends string> extends UpdateApplyResult {
  /** Stored rows per link table that a `replace` would have deleted but merge kept. */
  preservedLinkRows: Partial<Record<TLinkKind, number>>
  /** Scraped related entries skipped because their targets are not in the library. */
  unresolvedRelatedEntries?: number
}

export interface UpdateResolvedSelection<
  TSurface extends string,
  TCoreSurface extends TSurface,
  TMediaSurface extends TSurface,
  TRelationSurface extends TSurface = never
> {
  surfaces: TSurface[]
  coreSurfaces: TCoreSurface[]
  mediaSurfaces: TMediaSurface[]
  relationSurfaces: TRelationSurface[]
}

export interface PersonPlanContext {
  current: PersonCurrentState
  incoming: PersonIncomingBuildResult
  selection: UpdateResolvedSelection<
    PersonUpdateSurface,
    PersonUpdateCoreSurface,
    PersonUpdateMediaSurface,
    PersonUpdateRelationSurface
  >
  policy: IngestUpdatePolicy
}

export interface CompanyPlanContext {
  current: CompanyCurrentState
  incoming: CompanyIncomingBuildResult
  selection: UpdateResolvedSelection<
    CompanyUpdateSurface,
    CompanyUpdateCoreSurface,
    CompanyUpdateMediaSurface,
    CompanyUpdateRelationSurface
  >
  policy: IngestUpdatePolicy
}

export interface CharacterPlanContext {
  current: CharacterCurrentState
  incoming: CharacterIncomingBuildResult
  relationGraph?: IngestCharacterGraph
  selection: UpdateResolvedSelection<
    CharacterUpdateSurface,
    CharacterUpdateCoreSurface,
    CharacterUpdateMediaSurface,
    CharacterUpdateRelationSurface
  >
  policy: IngestUpdatePolicy
}

export interface GamePlanContext {
  current: GameCurrentState
  incoming: GameIncomingBuildResult
  relationGraph?: IngestGameGraph
  selection: UpdateResolvedSelection<
    GameUpdateSurface,
    GameUpdateCoreSurface,
    GameUpdateMediaSurface,
    GameUpdateRelationSurface
  >
  policy: IngestUpdatePolicy
}

export interface AnimePlanContext {
  current: AnimeCurrentState
  incoming: AnimeIncomingBuildResult
  relationGraph?: IngestAnimeGraph
  selection: UpdateResolvedSelection<
    AnimeUpdateSurface,
    AnimeUpdateCoreSurface,
    AnimeUpdateMediaSurface,
    AnimeUpdateRelationSurface
  >
  policy: IngestUpdatePolicy
}

export interface ComicPlanContext {
  current: ComicCurrentState
  incoming: ComicIncomingBuildResult
  relationGraph?: IngestComicGraph
  selection: UpdateResolvedSelection<
    ComicUpdateSurface,
    ComicUpdateCoreSurface,
    ComicUpdateMediaSurface,
    ComicUpdateRelationSurface
  >
  policy: IngestUpdatePolicy
}

export interface NovelPlanContext {
  current: NovelCurrentState
  incoming: NovelIncomingBuildResult
  relationGraph?: IngestNovelGraph
  selection: UpdateResolvedSelection<
    NovelUpdateSurface,
    NovelUpdateCoreSurface,
    NovelUpdateMediaSurface,
    NovelUpdateRelationSurface
  >
  policy: IngestUpdatePolicy
}

export interface TagLinkValue {
  tagId: string
  isSpoiler: boolean
  note: string | null
}

export interface UpdateCurrentSelection<TCoreSurface extends string> {
  coreSurfaces: TCoreSurface[]
}
