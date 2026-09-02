import type { ComicScraperLookup } from '@shared/scraper'
import type { ExternalId } from '@shared/identity'
import type { IngestAddResult } from '../results'

export interface IngestAddComicResult extends IngestAddResult {
  comicId: string
}

export interface IngestAddComicFromScraperOptions {
  dirPath?: string
  targetCollectionId?: string
}

export interface IngestAddComicFromScraperParams {
  profileId: string
  lookup: ComicScraperLookup
  options?: IngestAddComicFromScraperOptions
}

export type IngestAddComicFromScraperResult = IngestAddComicResult

export interface IngestAddComicDirectSeed {
  name: string
  knownIds?: ExternalId[]
}

export type IngestAddComicDirectOptions = IngestAddComicFromScraperOptions

export interface IngestAddComicDirectParams {
  seed: IngestAddComicDirectSeed
  options?: IngestAddComicDirectOptions
}

export type IngestAddComicDirectResult = IngestAddComicResult
