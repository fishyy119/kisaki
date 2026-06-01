import type { ScraperLookup } from '../contributions/scraper-providers'

export type IngestExistingReason = 'externalId' | 'path'

export type IngestWarningCode = 'asset-persist-failed'

export interface IngestWarning {
  code: IngestWarningCode
  message: string
}

export interface IngestAddGameFromScraperOptions {
  gameDirPath?: string
  gameFilePath?: string
  targetCollectionId?: string
  taskRun?: boolean
}

export interface IngestAddGameFromScraperResult {
  gameId: string
  isNew: boolean
  existingReason?: IngestExistingReason
  warnings?: readonly IngestWarning[]
}

export interface IngestGameAddCapability {
  fromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddGameFromScraperOptions
  ): Promise<IngestAddGameFromScraperResult>
}

export interface IngestGameCapability {
  add: IngestGameAddCapability
}

export interface IngestCapability {
  game: IngestGameCapability
}
