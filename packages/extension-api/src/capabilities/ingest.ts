import type { ScraperLookup } from '../contributions/scraper-providers'
import type { ExternalId } from '../shared'

export type IngestExistingReason = 'externalId' | 'path'

export type IngestWarningCode = 'asset-persist-failed'

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

export interface IngestUpdateLookup {
  name: string
  knownIds: readonly ExternalId[]
}

export interface IngestUpdateInput<TSurface extends string> {
  rootId: string
  profileId: string
  lookup: IngestUpdateLookup
  selection: IngestUpdateSelection<TSurface>
  policy: IngestUpdatePolicy
}

export const GAME_UPDATE_SURFACES = [
  { key: 'name', group: 'core', cardinality: 'singular' },
  { key: 'originalName', group: 'core', cardinality: 'singular' },
  { key: 'releaseDate', group: 'core', cardinality: 'singular' },
  { key: 'description', group: 'core', cardinality: 'singular' },
  { key: 'relatedSites', group: 'core', cardinality: 'collection' },
  { key: 'externalIds', group: 'core', cardinality: 'collection' },
  { key: 'tags', group: 'core', cardinality: 'collection' },
  { key: 'person', group: 'relation', cardinality: 'collection' },
  { key: 'company', group: 'relation', cardinality: 'collection' },
  { key: 'character', group: 'relation', cardinality: 'collection' },
  { key: 'covers', group: 'media', cardinality: 'singular' },
  { key: 'backdrops', group: 'media', cardinality: 'singular' },
  { key: 'logos', group: 'media', cardinality: 'singular' },
  { key: 'icons', group: 'media', cardinality: 'singular' }
] as const satisfies readonly IngestUpdateSurfaceDefinition[]

export type GameUpdateSurface = (typeof GAME_UPDATE_SURFACES)[number]['key']

export type GameUpdateSelection = IngestUpdateSelection<GameUpdateSurface>

export type IngestGameUpdateFromScraperInput = IngestUpdateInput<GameUpdateSurface>

export interface IngestWarning {
  code: IngestWarningCode
  message: string
}

export interface IngestAddGameFromScraperOptions {
  gameDirPath?: string
  gameFilePath?: string
  targetCollectionId?: string
  taskRun?: boolean
}

export interface IngestAddGameFromScraperResult {
  gameId: string
  isNew: boolean
  existingReason?: IngestExistingReason
  warnings?: readonly IngestWarning[]
}

export interface IngestUpdateResult {
  warnings?: readonly IngestWarning[]
}

export interface IngestGameAddCapability {
  fromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddGameFromScraperOptions
  ): Promise<IngestAddGameFromScraperResult>
}

export interface IngestGameUpdateFromScraperOptions {
  taskRun?: boolean
}

export interface IngestGameUpdateCapability {
  fromScraper(
    input: IngestGameUpdateFromScraperInput,
    options?: IngestGameUpdateFromScraperOptions
  ): Promise<IngestUpdateResult>
}

export interface IngestGameCapability {
  add: IngestGameAddCapability
  update: IngestGameUpdateCapability
}

export interface IngestCapability {
  game: IngestGameCapability
}
