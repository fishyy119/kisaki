import type { MovieScraperLookup } from '@shared/scraper'
import type { ExternalId } from '@shared/identity'
import type { IngestAddResult } from '../common'

export interface IngestAddMovieResult extends IngestAddResult {
  movieId: string
}

export interface IngestAddMovieFromScraperOptions {
  movieDirPath?: string
  targetCollectionId?: string
}

export interface IngestAddMovieFromScraperParams {
  profileId: string
  lookup: MovieScraperLookup
  options?: IngestAddMovieFromScraperOptions
}

export type IngestAddMovieFromScraperResult = IngestAddMovieResult

export interface IngestAddMovieDirectSeed {
  name: string
  knownIds?: ExternalId[]
}

export type IngestAddMovieDirectOptions = IngestAddMovieFromScraperOptions

export interface IngestAddMovieDirectParams {
  seed: IngestAddMovieDirectSeed
  options?: IngestAddMovieDirectOptions
}

export type IngestAddMovieDirectResult = IngestAddMovieResult
