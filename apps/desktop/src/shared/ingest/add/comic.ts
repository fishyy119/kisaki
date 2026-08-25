import type { ComicScraperLookup } from '@shared/scraper'
import type { ExternalId } from '@shared/identity'
import type { IngestAddResult } from '../common'

export interface IngestAddComicResult extends IngestAddResult {
  comicId: string
}

export interface IngestAddComicFromScraperOptions {
  comicDirPath?: string
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
