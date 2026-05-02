import type { ScraperLookup } from '../contributions/scrapers'

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
}

export interface IngestAddGameFromScraperResult {
  gameId: string
  isNew: boolean
  existingReason?: IngestExistingReason
  warnings?: readonly IngestWarning[]
}

export interface IngestGamesCapability {
  addFromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddGameFromScraperOptions
  ): Promise<IngestAddGameFromScraperResult>
}

export interface IngestCapability {
  games: IngestGamesCapability
}
