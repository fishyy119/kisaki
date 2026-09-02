import type { ScraperLookup } from '@shared/scraper'
import type { IngestAddResult } from '../results'

export interface IngestAddCharacterResult extends IngestAddResult {
  characterId: string
}

export interface IngestAddCharacterFromScraperOptions {
  targetCollectionId?: string
}

export interface IngestAddCharacterFromScraperParams {
  profileId: string
  lookup: ScraperLookup
  options?: IngestAddCharacterFromScraperOptions
}

export type IngestAddCharacterFromScraperResult = IngestAddCharacterResult
