import type { NovelScraperLookup } from '@shared/scraper'
import type { ExternalId } from '@shared/identity'
import type { IngestAddResult } from '../results'

export interface IngestAddNovelResult extends IngestAddResult {
  novelId: string
}

export interface IngestAddNovelFromScraperOptions {
  dirPath?: string
  targetCollectionId?: string
}

export interface IngestAddNovelFromScraperParams {
  profileId: string
  lookup: NovelScraperLookup
  options?: IngestAddNovelFromScraperOptions
}

export type IngestAddNovelFromScraperResult = IngestAddNovelResult

export interface IngestAddNovelDirectSeed {
  name: string
  knownIds?: ExternalId[]
}

export type IngestAddNovelDirectOptions = IngestAddNovelFromScraperOptions

export interface IngestAddNovelDirectParams {
  seed: IngestAddNovelDirectSeed
  options?: IngestAddNovelDirectOptions
}

export type IngestAddNovelDirectResult = IngestAddNovelResult
