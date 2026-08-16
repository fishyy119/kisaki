import type {
  AnimeScraperLookup,
  GameScraperLookup,
  MovieScraperLookup,
  ScraperLookup,
  TvScraperLookup
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

export interface IngestAddTvFromScraperOptions {
  tvDirPath?: string
  targetCollectionId?: string
}

export interface IngestAddTvFromScraperResult {
  tvId: string
  isNew: boolean
  existingReason?: IngestExistingReason
  warnings?: readonly IngestWarning[]
}

export interface IngestAddMovieFromScraperOptions {
  movieDirPath?: string
  targetCollectionId?: string
}

export interface IngestAddMovieFromScraperResult {
  movieId: string
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

export interface IngestTvAddCapability {
  /** Runs the ingest inline and resolves with its result. */
  fromScraper(
    profileId: string,
    lookup: TvScraperLookup,
    options?: IngestAddTvFromScraperOptions
  ): Promise<IngestAddTvFromScraperResult>
  /**
   * Starts the ingest as a user-visible task run attributed to this extension
   * and resolves as soon as the run exists.
   */
  startFromScraper(
    profileId: string,
    lookup: TvScraperLookup,
    options?: IngestAddTvFromScraperOptions
  ): Promise<IngestTaskRunStart>
}

export interface IngestTvCapability {
  add: IngestTvAddCapability
}

export interface IngestMovieAddCapability {
  /** Runs the ingest inline and resolves with its result. */
  fromScraper(
    profileId: string,
    lookup: MovieScraperLookup,
    options?: IngestAddMovieFromScraperOptions
  ): Promise<IngestAddMovieFromScraperResult>
  /**
   * Starts the ingest as a user-visible task run attributed to this extension
   * and resolves as soon as the run exists.
   */
  startFromScraper(
    profileId: string,
    lookup: MovieScraperLookup,
    options?: IngestAddMovieFromScraperOptions
  ): Promise<IngestTaskRunStart>
}

export interface IngestMovieCapability {
  add: IngestMovieAddCapability
}

export interface IngestCapability {
  game: IngestGameCapability
  anime: IngestAnimeCapability
  tv: IngestTvCapability
  movie: IngestMovieCapability
}
