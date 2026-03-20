import type { ScraperLookup } from '@shared/scraper'
import type { ExternalId } from '@shared/identity'
import type { IngestAddResult } from '../common'

export interface IngestAddGameResult extends IngestAddResult {
  gameId: string
}

export interface IngestAddGameFromScraperOptions {
  gameDirPath?: string
  gameFilePath?: string
  targetCollectionId?: string
  skipScraperValidation?: boolean
}

export interface IngestAddGameFromScraperParams {
  profileId: string
  lookup: ScraperLookup
  options?: IngestAddGameFromScraperOptions
}

export type IngestAddGameFromScraperResult = IngestAddGameResult

export interface IngestAddGameDirectSeed {
  name: string
  knownIds?: ExternalId[]
}

export type IngestAddGameDirectOptions = Omit<
  IngestAddGameFromScraperOptions,
  'skipScraperValidation'
>

export interface IngestAddGameDirectParams {
  seed: IngestAddGameDirectSeed
  options?: IngestAddGameDirectOptions
}

export type IngestAddGameDirectResult = IngestAddGameResult
