import type { AnimeScraperLookup } from '@shared/scraper'
import type { ExternalId } from '@shared/identity'
import type { IngestAddResult } from '../results'

export interface IngestAddAnimeResult extends IngestAddResult {
  animeId: string
}

export interface IngestAddAnimeFromScraperOptions {
  dirPath?: string
  targetCollectionId?: string
}

export interface IngestAddAnimeFromScraperParams {
  profileId: string
  lookup: AnimeScraperLookup
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
