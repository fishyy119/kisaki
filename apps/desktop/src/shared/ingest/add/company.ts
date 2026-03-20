import type { ScraperLookup } from '@shared/scraper'
import type { IngestAddResult } from '../common'

export interface IngestAddCompanyResult extends IngestAddResult {
  companyId: string
}

export interface IngestAddCompanyFromScraperOptions {
  targetCollectionId?: string
  skipScraperValidation?: boolean
}

export interface IngestAddCompanyFromScraperParams {
  profileId: string
  lookup: ScraperLookup
  options?: IngestAddCompanyFromScraperOptions
}

export type IngestAddCompanyFromScraperResult = IngestAddCompanyResult
