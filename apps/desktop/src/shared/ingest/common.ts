/**
 * Shared ingest contracts.
 *
 * Ingest orchestrates scraper facts to graph persistence.
 */

import type { ScraperLookup } from '@shared/scraper'

/** Reason why an entity was not newly added. */
export type ExistingReason = 'externalId' | 'path'

/** Stable warning code emitted by ingest post-commit work. */
export type IngestWarningCode = 'asset-persist-failed'

/** Warning emitted after the main DB transaction succeeds. */
export interface IngestWarning {
  code: IngestWarningCode
  message: string
}

/**
 * Base result for ingest add flows.
 */
export interface IngestAddResult {
  isNew: boolean
  existingReason?: ExistingReason
  warnings?: IngestWarning[]
}

/** Result of ingesting a game. */
export interface IngestAddGameResult extends IngestAddResult {
  gameId: string
}

/** Result of ingesting a person. */
export interface IngestAddPersonResult extends IngestAddResult {
  personId: string
}

/** Result of ingesting a company. */
export interface IngestAddCompanyResult extends IngestAddResult {
  companyId: string
}

/** Result of ingesting a character. */
export interface IngestAddCharacterResult extends IngestAddResult {
  characterId: string
}

/**
 * Normalized entity node in an ingest graph.
 */
export interface IngestEntityNode<TCore> {
  /** Canonical identity key scoped to the normalized ingest graph. */
  identityKey: string
  core: TCore
}

/**
 * Shared relation fields that must be persisted explicitly.
 */
export interface IngestLinkBase {
  isSpoiler: boolean
  note?: string
}

/**
 * Common params for add-from-scraper orchestration.
 */
export interface IngestFromScraperParamsBase<TOptions> {
  profileId: string
  lookup: ScraperLookup
  options?: TOptions
}

/**
 * Ingest options for game add flow.
 */
export interface IngestAddGameFromScraperOptions {
  gameDirPath?: string
  gameFilePath?: string
  targetCollectionId?: string
  skipScraperValidation?: boolean
}

/**
 * Ingest options for person add flow.
 */
export interface IngestAddPersonFromScraperOptions {
  targetCollectionId?: string
  skipScraperValidation?: boolean
}

/**
 * Ingest options for company add flow.
 */
export interface IngestAddCompanyFromScraperOptions {
  targetCollectionId?: string
  skipScraperValidation?: boolean
}

/**
 * Ingest options for character add flow.
 */
export interface IngestAddCharacterFromScraperOptions {
  targetCollectionId?: string
  skipScraperValidation?: boolean
}
