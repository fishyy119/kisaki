import type { ScraperLookup } from '@shared/scraper'
import type { ExternalId } from '@shared/identity'
import type { IngestAddResult } from '../common'

export interface IngestAddAnimeResult extends IngestAddResult {
  animeId: string
}

export interface IngestAddAnimeFromScraperOptions {
  animeDirPath?: string
  targetCollectionId?: string
}

export interface IngestAddAnimeFromScraperParams {
  profileId: string
  lookup: ScraperLookup
  options?: IngestAddAnimeFromScraperOptions
}

export type IngestAddAnimeFromScraperResult = IngestAddAnimeResult

export interface IngestAddAnimeDirectSeed {
  name: string
  knownIds?: ExternalId[]
}

export type IngestAddAnimeDirectOptions = IngestAddAnimeFromScraperOptions

export interface IngestAddAnimeDirectParams {
  seed: IngestAddAnimeDirectSeed
  options?: IngestAddAnimeDirectOptions
}

export type IngestAddAnimeDirectResult = IngestAddAnimeResult
