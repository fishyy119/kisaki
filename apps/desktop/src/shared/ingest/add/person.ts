import type { ScraperLookup } from '@shared/scraper'
import type { IngestAddResult } from '../common'

export interface IngestAddPersonResult extends IngestAddResult {
  personId: string
}

export interface IngestAddPersonFromScraperOptions {
  targetCollectionId?: string
  skipScraperValidation?: boolean
}

export interface IngestAddPersonFromScraperParams {
  profileId: string
  lookup: ScraperLookup
  options?: IngestAddPersonFromScraperOptions
}

export type IngestAddPersonFromScraperResult = IngestAddPersonResult
