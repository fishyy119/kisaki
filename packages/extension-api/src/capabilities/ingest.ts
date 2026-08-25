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

export interface IngestWarning {
  code: IngestWarningCode
  message: string
}

export interface IngestAddGameFromScraperOptions {
  gameDirPath?: string
  gameFilePath?: string
  targetCollectionId?: string
}

export interface IngestAddGameFromScraperResult {
  gameId: string
  isNew: boolean
  existingReason?: IngestExistingReason
  warnings?: readonly IngestWarning[]
}

export interface IngestAddAnimeFromScraperOptions {
  animeDirPath?: string
  targetCollectionId?: string
}

export interface IngestAddAnimeFromScraperResult {
  animeId: string
  isNew: boolean
  existingReason?: IngestExistingReason
  warnings?: readonly IngestWarning[]
}

export interface IngestAddComicFromScraperOptions {
  comicDirPath?: string
  targetCollectionId?: string
}

export interface IngestAddComicFromScraperResult {
  comicId: string
  isNew: boolean
  existingReason?: IngestExistingReason
  warnings?: readonly IngestWarning[]
}

export interface IngestAddNovelFromScraperOptions {
  novelDirPath?: string
  targetCollectionId?: string
}

export interface IngestAddNovelFromScraperResult {
  novelId: string
  isNew: boolean
  existingReason?: IngestExistingReason
  warnings?: readonly IngestWarning[]
}

export interface IngestUpdateResult {
  warnings?: readonly IngestWarning[]
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
    options?: IngestAddGameFromScraperOptions
  ): Promise<IngestAddGameFromScraperResult>
  /**
   * Starts the ingest as a user-visible task run attributed to this extension
   * and resolves as soon as the run exists.
   */
  startFromScraper(
    profileId: string,
    lookup: GameScraperLookup,
    options?: IngestAddGameFromScraperOptions
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
    options?: IngestAddAnimeFromScraperOptions
  ): Promise<IngestAddAnimeFromScraperResult>
  /**
   * Starts the ingest as a user-visible task run attributed to this extension
   * and resolves as soon as the run exists.
   */
  startFromScraper(
    profileId: string,
    lookup: AnimeScraperLookup,
    options?: IngestAddAnimeFromScraperOptions
  ): Promise<IngestTaskRunStart>
}

export interface IngestAnimeCapability {
  add: IngestAnimeAddCapability
}

export interface IngestComicAddCapability {
  /** Runs the ingest inline and resolves with its result. */
  fromScraper(
    profileId: string,
    lookup: ComicScraperLookup,
    options?: IngestAddComicFromScraperOptions
  ): Promise<IngestAddComicFromScraperResult>
  /**
   * Starts the ingest as a user-visible task run attributed to this extension
   * and resolves as soon as the run exists.
   */
  startFromScraper(
    profileId: string,
    lookup: ComicScraperLookup,
    options?: IngestAddComicFromScraperOptions
  ): Promise<IngestTaskRunStart>
}

export interface IngestComicCapability {
  add: IngestComicAddCapability
}

export interface IngestNovelAddCapability {
  /** Runs the ingest inline and resolves with its result. */
  fromScraper(
    profileId: string,
    lookup: NovelScraperLookup,
    options?: IngestAddNovelFromScraperOptions
  ): Promise<IngestAddNovelFromScraperResult>
  /**
   * Starts the ingest as a user-visible task run attributed to this extension
   * and resolves as soon as the run exists.
   */
  startFromScraper(
    profileId: string,
    lookup: NovelScraperLookup,
    options?: IngestAddNovelFromScraperOptions
  ): Promise<IngestTaskRunStart>
}

export interface IngestNovelCapability {
  add: IngestNovelAddCapability
}

export interface IngestCapability {
  game: IngestGameCapability
  anime: IngestAnimeCapability
  comic: IngestComicCapability
  novel: IngestNovelCapability
}
