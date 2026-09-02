import type {
  AnimeScraperLookup,
  ComicScraperLookup,
  GameScraperLookup,
  NovelScraperLookup,
  ScraperLookup
} from '../contributions/scraper-providers'

export type IngestExistingReason = 'externalId' | 'path'

export type IngestWarningCode =
  'asset-persist-failed' | 'collection-replace-degraded' | 'related-entry-not-in-library'

export type IngestUpdateSurfaceGroup = 'core' | 'media' | 'relation'

export type IngestUpdateSurfaceCardinality = 'singular' | 'collection'

export interface IngestUpdateSurfaceDefinition<TKey extends string = string> {
  key: TKey
  group: IngestUpdateSurfaceGroup
  cardinality: IngestUpdateSurfaceCardinality
}

export interface IngestUpdatePolicy {
  singularUpdate: 'ifMissing' | 'overwrite'
  collectionUpdate: 'merge' | 'replace'
}

export interface IngestUpdateSelection<TSurface extends string> {
  surfaces: readonly TSurface[]
}

export interface IngestUpdateInput<
  TSurface extends string,
  TLookup extends ScraperLookup = ScraperLookup
> {
  rootId: string
  profileId: string
  lookup: TLookup
  selection: IngestUpdateSelection<TSurface>
  policy: IngestUpdatePolicy
}

export const GAME_UPDATE_SURFACES = [
  { key: 'name', group: 'core', cardinality: 'singular' },
  { key: 'originalName', group: 'core', cardinality: 'singular' },
  { key: 'aliases', group: 'core', cardinality: 'collection' },
  { key: 'releaseDate', group: 'core', cardinality: 'singular' },
  { key: 'description', group: 'core', cardinality: 'singular' },
  { key: 'externalSites', group: 'core', cardinality: 'collection' },
  { key: 'externalIds', group: 'core', cardinality: 'collection' },
  { key: 'tags', group: 'core', cardinality: 'collection' },
  { key: 'person', group: 'relation', cardinality: 'collection' },
  { key: 'company', group: 'relation', cardinality: 'collection' },
  { key: 'character', group: 'relation', cardinality: 'collection' },
  { key: 'characterPerson', group: 'relation', cardinality: 'collection' },
  { key: 'relatedEntries', group: 'relation', cardinality: 'collection' },
  { key: 'covers', group: 'media', cardinality: 'singular' },
  { key: 'backdrops', group: 'media', cardinality: 'singular' },
  { key: 'logos', group: 'media', cardinality: 'singular' },
  { key: 'icons', group: 'media', cardinality: 'singular' }
] as const satisfies readonly IngestUpdateSurfaceDefinition[]

export type GameUpdateSurface = (typeof GAME_UPDATE_SURFACES)[number]['key']

export type GameUpdateSelection = IngestUpdateSelection<GameUpdateSurface>

export type IngestGameUpdateFromScraperInput = IngestUpdateInput<
  GameUpdateSurface,
  GameScraperLookup
>

export const ANIME_UPDATE_SURFACES = [
  { key: 'name', group: 'core', cardinality: 'singular' },
  { key: 'originalName', group: 'core', cardinality: 'singular' },
  { key: 'aliases', group: 'core', cardinality: 'collection' },
  { key: 'releaseDate', group: 'core', cardinality: 'singular' },
  { key: 'description', group: 'core', cardinality: 'singular' },
  { key: 'format', group: 'core', cardinality: 'singular' },
  { key: 'totalEpisodes', group: 'core', cardinality: 'singular' },
  { key: 'externalSites', group: 'core', cardinality: 'collection' },
  { key: 'externalIds', group: 'core', cardinality: 'collection' },
  { key: 'tags', group: 'core', cardinality: 'collection' },
  { key: 'episodes', group: 'core', cardinality: 'collection' },
  { key: 'person', group: 'relation', cardinality: 'collection' },
  { key: 'company', group: 'relation', cardinality: 'collection' },
  { key: 'character', group: 'relation', cardinality: 'collection' },
  { key: 'characterPerson', group: 'relation', cardinality: 'collection' },
  { key: 'relatedEntries', group: 'relation', cardinality: 'collection' },
  { key: 'covers', group: 'media', cardinality: 'singular' },
  { key: 'backdrops', group: 'media', cardinality: 'singular' },
  { key: 'logos', group: 'media', cardinality: 'singular' }
] as const satisfies readonly IngestUpdateSurfaceDefinition[]

export type AnimeUpdateSurface = (typeof ANIME_UPDATE_SURFACES)[number]['key']

export type AnimeUpdateSelection = IngestUpdateSelection<AnimeUpdateSurface>

export type IngestAnimeUpdateFromScraperInput = IngestUpdateInput<
  AnimeUpdateSurface,
  AnimeScraperLookup
>

export const COMIC_UPDATE_SURFACES = [
  { key: 'name', group: 'core', cardinality: 'singular' },
  { key: 'originalName', group: 'core', cardinality: 'singular' },
  { key: 'aliases', group: 'core', cardinality: 'collection' },
  { key: 'releaseDate', group: 'core', cardinality: 'singular' },
  { key: 'description', group: 'core', cardinality: 'singular' },
  { key: 'format', group: 'core', cardinality: 'singular' },
  { key: 'totalVolumes', group: 'core', cardinality: 'singular' },
  { key: 'totalChapters', group: 'core', cardinality: 'singular' },
  { key: 'externalSites', group: 'core', cardinality: 'collection' },
  { key: 'externalIds', group: 'core', cardinality: 'collection' },
  { key: 'tags', group: 'core', cardinality: 'collection' },
  { key: 'chapters', group: 'core', cardinality: 'collection' },
  { key: 'person', group: 'relation', cardinality: 'collection' },
  { key: 'company', group: 'relation', cardinality: 'collection' },
  { key: 'character', group: 'relation', cardinality: 'collection' },
  { key: 'characterPerson', group: 'relation', cardinality: 'collection' },
  { key: 'relatedEntries', group: 'relation', cardinality: 'collection' },
  { key: 'covers', group: 'media', cardinality: 'singular' },
  { key: 'backdrops', group: 'media', cardinality: 'singular' },
  { key: 'logos', group: 'media', cardinality: 'singular' }
] as const satisfies readonly IngestUpdateSurfaceDefinition[]

export type ComicUpdateSurface = (typeof COMIC_UPDATE_SURFACES)[number]['key']

export type ComicUpdateSelection = IngestUpdateSelection<ComicUpdateSurface>

export type IngestComicUpdateFromScraperInput = IngestUpdateInput<
  ComicUpdateSurface,
  ComicScraperLookup
>

export const NOVEL_UPDATE_SURFACES = [
  { key: 'name', group: 'core', cardinality: 'singular' },
  { key: 'originalName', group: 'core', cardinality: 'singular' },
  { key: 'aliases', group: 'core', cardinality: 'collection' },
  { key: 'releaseDate', group: 'core', cardinality: 'singular' },
  { key: 'description', group: 'core', cardinality: 'singular' },
  { key: 'format', group: 'core', cardinality: 'singular' },
  { key: 'totalVolumes', group: 'core', cardinality: 'singular' },
  { key: 'externalSites', group: 'core', cardinality: 'collection' },
  { key: 'externalIds', group: 'core', cardinality: 'collection' },
  { key: 'tags', group: 'core', cardinality: 'collection' },
  { key: 'volumes', group: 'core', cardinality: 'collection' },
  { key: 'person', group: 'relation', cardinality: 'collection' },
  { key: 'company', group: 'relation', cardinality: 'collection' },
  { key: 'character', group: 'relation', cardinality: 'collection' },
  { key: 'characterPerson', group: 'relation', cardinality: 'collection' },
  { key: 'relatedEntries', group: 'relation', cardinality: 'collection' },
  { key: 'covers', group: 'media', cardinality: 'singular' },
  { key: 'backdrops', group: 'media', cardinality: 'singular' },
  { key: 'logos', group: 'media', cardinality: 'singular' }
] as const satisfies readonly IngestUpdateSurfaceDefinition[]

export type NovelUpdateSurface = (typeof NOVEL_UPDATE_SURFACES)[number]['key']

export type NovelUpdateSelection = IngestUpdateSelection<NovelUpdateSurface>

export type IngestNovelUpdateFromScraperInput = IngestUpdateInput<
  NovelUpdateSurface,
  NovelScraperLookup
>

export interface IngestWarning {
  code: IngestWarningCode
  message: string
}

export interface IngestAddGameFromScraperOptions {
  dirPath?: string | undefined
  gameFilePath?: string | undefined
  targetCollectionId?: string | undefined
}

export interface IngestAddGameFromScraperResult {
  gameId: string
  isNew: boolean
  existingReason?: IngestExistingReason | undefined
  warnings?: readonly IngestWarning[] | undefined
}

export interface IngestAddAnimeFromScraperOptions {
  dirPath?: string | undefined
  targetCollectionId?: string | undefined
}

export interface IngestAddAnimeFromScraperResult {
  animeId: string
  isNew: boolean
  existingReason?: IngestExistingReason | undefined
  warnings?: readonly IngestWarning[] | undefined
}

export interface IngestAddComicFromScraperOptions {
  dirPath?: string | undefined
  targetCollectionId?: string | undefined
}

export interface IngestAddComicFromScraperResult {
  comicId: string
  isNew: boolean
  existingReason?: IngestExistingReason | undefined
  warnings?: readonly IngestWarning[] | undefined
}

export interface IngestAddNovelFromScraperOptions {
  dirPath?: string | undefined
  targetCollectionId?: string | undefined
}

export interface IngestAddNovelFromScraperResult {
  novelId: string
  isNew: boolean
  existingReason?: IngestExistingReason | undefined
  warnings?: readonly IngestWarning[] | undefined
}

export interface IngestUpdateResult {
  warnings?: readonly IngestWarning[] | undefined
}

/** Identifies a task run the caller can observe through the task-runs capability. */
export interface IngestTaskRunStart {
  runId: string
  createdAt: number
}

export interface IngestGameAddCapability {
  /** Runs the ingest inline and resolves with its result. */
  fromScraper(
    profileId: string,
    lookup: GameScraperLookup,
    options?: IngestAddGameFromScraperOptions | undefined
  ): Promise<IngestAddGameFromScraperResult>
  /**
   * Starts the ingest as a user-visible task run attributed to this extension
   * and resolves as soon as the run exists.
   */
  startFromScraper(
    profileId: string,
    lookup: GameScraperLookup,
    options?: IngestAddGameFromScraperOptions | undefined
  ): Promise<IngestTaskRunStart>
}

export interface IngestGameUpdateCapability {
  /** Runs the update inline and resolves with its result. */
  fromScraper(input: IngestGameUpdateFromScraperInput): Promise<IngestUpdateResult>
  /**
   * Starts the update as a user-visible task run attributed to this extension
   * and resolves as soon as the run exists.
   */
  startFromScraper(input: IngestGameUpdateFromScraperInput): Promise<IngestTaskRunStart>
}

export interface IngestGameCapability {
  add: IngestGameAddCapability
  update: IngestGameUpdateCapability
}

export interface IngestAnimeAddCapability {
  /** Runs the ingest inline and resolves with its result. */
  fromScraper(
    profileId: string,
    lookup: AnimeScraperLookup,
    options?: IngestAddAnimeFromScraperOptions | undefined
  ): Promise<IngestAddAnimeFromScraperResult>
  /**
   * Starts the ingest as a user-visible task run attributed to this extension
   * and resolves as soon as the run exists.
   */
  startFromScraper(
    profileId: string,
    lookup: AnimeScraperLookup,
    options?: IngestAddAnimeFromScraperOptions | undefined
  ): Promise<IngestTaskRunStart>
}

export interface IngestAnimeUpdateCapability {
  /** Runs the update inline and resolves with its result. */
  fromScraper(input: IngestAnimeUpdateFromScraperInput): Promise<IngestUpdateResult>
  /**
   * Starts the update as a user-visible task run attributed to this extension
   * and resolves as soon as the run exists.
   */
  startFromScraper(input: IngestAnimeUpdateFromScraperInput): Promise<IngestTaskRunStart>
}

export interface IngestAnimeCapability {
  add: IngestAnimeAddCapability
  update: IngestAnimeUpdateCapability
}

export interface IngestComicAddCapability {
  /** Runs the ingest inline and resolves with its result. */
  fromScraper(
    profileId: string,
    lookup: ComicScraperLookup,
    options?: IngestAddComicFromScraperOptions | undefined
  ): Promise<IngestAddComicFromScraperResult>
  /**
   * Starts the ingest as a user-visible task run attributed to this extension
   * and resolves as soon as the run exists.
   */
  startFromScraper(
    profileId: string,
    lookup: ComicScraperLookup,
    options?: IngestAddComicFromScraperOptions | undefined
  ): Promise<IngestTaskRunStart>
}

export interface IngestComicUpdateCapability {
  /** Runs the update inline and resolves with its result. */
  fromScraper(input: IngestComicUpdateFromScraperInput): Promise<IngestUpdateResult>
  /**
   * Starts the update as a user-visible task run attributed to this extension
   * and resolves as soon as the run exists.
   */
  startFromScraper(input: IngestComicUpdateFromScraperInput): Promise<IngestTaskRunStart>
}

export interface IngestComicCapability {
  add: IngestComicAddCapability
  update: IngestComicUpdateCapability
}

export interface IngestNovelAddCapability {
  /** Runs the ingest inline and resolves with its result. */
  fromScraper(
    profileId: string,
    lookup: NovelScraperLookup,
    options?: IngestAddNovelFromScraperOptions | undefined
  ): Promise<IngestAddNovelFromScraperResult>
  /**
   * Starts the ingest as a user-visible task run attributed to this extension
   * and resolves as soon as the run exists.
   */
  startFromScraper(
    profileId: string,
    lookup: NovelScraperLookup,
    options?: IngestAddNovelFromScraperOptions | undefined
  ): Promise<IngestTaskRunStart>
}

export interface IngestNovelUpdateCapability {
  /** Runs the update inline and resolves with its result. */
  fromScraper(input: IngestNovelUpdateFromScraperInput): Promise<IngestUpdateResult>
  /**
   * Starts the update as a user-visible task run attributed to this extension
   * and resolves as soon as the run exists.
   */
  startFromScraper(input: IngestNovelUpdateFromScraperInput): Promise<IngestTaskRunStart>
}

export interface IngestNovelCapability {
  add: IngestNovelAddCapability
  update: IngestNovelUpdateCapability
}

/**
 * Ingest surface for the four media kinds. Satellite entities (person,
 * company, character) have application-side update engines too, but are
 * deliberately not exposed here: capability surface is added on demand, and
 * no extension needs satellite ingest yet.
 */
export interface IngestCapability {
  game: IngestGameCapability
  anime: IngestAnimeCapability
  comic: IngestComicCapability
  novel: IngestNovelCapability
}
