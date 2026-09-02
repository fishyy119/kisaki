import type { GameScraperLookup } from '@shared/scraper'
import type { ExternalId } from '@shared/identity'
import type { IngestAddResult } from '../results'

export interface IngestAddGameResult extends IngestAddResult {
  gameId: string
}

export interface IngestAddGameFromScraperOptions {
  dirPath?: string
  gameFilePath?: string
  targetCollectionId?: string
}

export interface IngestAddGameFromScraperParams {
  profileId: string
  lookup: GameScraperLookup
  options?: IngestAddGameFromScraperOptions
}

export type IngestAddGameFromScraperResult = IngestAddGameResult

export interface IngestAddGameDirectSeed {
  name: string
  knownIds?: ExternalId[]
}

export type IngestAddGameDirectOptions = IngestAddGameFromScraperOptions

export interface IngestAddGameDirectParams {
  seed: IngestAddGameDirectSeed
  options?: IngestAddGameDirectOptions
}

export type IngestAddGameDirectResult = IngestAddGameResult
