import type { ScraperLookup } from '@shared/scraper'
import type { IngestAddResult } from '../results'

export interface IngestAddPersonResult extends IngestAddResult {
  personId: string
}

export interface IngestAddPersonFromScraperOptions {
  targetCollectionId?: string
}

export interface IngestAddPersonFromScraperParams {
  profileId: string
  lookup: ScraperLookup
  options?: IngestAddPersonFromScraperOptions
}

export type IngestAddPersonFromScraperResult = IngestAddPersonResult
