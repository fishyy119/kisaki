import type { TvScraperLookup } from '@shared/scraper'
import type { ExternalId } from '@shared/identity'
import type { IngestAddResult } from '../common'

export interface IngestAddTvResult extends IngestAddResult {
  tvId: string
}

export interface IngestAddTvFromScraperOptions {
  tvDirPath?: string
  targetCollectionId?: string
}

export interface IngestAddTvFromScraperParams {
  profileId: string
  lookup: TvScraperLookup
  options?: IngestAddTvFromScraperOptions
}

export type IngestAddTvFromScraperResult = IngestAddTvResult

export interface IngestAddTvDirectSeed {
  name: string
  knownIds?: ExternalId[]
}

export type IngestAddTvDirectOptions = IngestAddTvFromScraperOptions

export interface IngestAddTvDirectParams {
  seed: IngestAddTvDirectSeed
  options?: IngestAddTvDirectOptions
}

export type IngestAddTvDirectResult = IngestAddTvResult
