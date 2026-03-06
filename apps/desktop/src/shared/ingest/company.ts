/**
 * Ingest contracts for company add orchestration.
 */

import type { CoreCompanyMetadata } from '@shared/metadata'
import type {
  IngestAddCompanyResult,
  IngestAddCompanyFromScraperOptions,
  IngestEntityNode,
  IngestFromScraperParamsBase
} from './common'

/**
 * Company node in normalized ingest graph.
 */
export interface IngestCompanyNode extends IngestEntityNode<CoreCompanyMetadata> {
  logoUrls?: string[]
}

/**
 * Canonical normalized graph produced by ingest for company flow.
 */
export interface IngestCompanyGraph {
  company: IngestCompanyNode
}

/**
 * IPC params for ingest:add-company-from-scraper.
 */
export type IngestAddCompanyFromScraperParams =
  IngestFromScraperParamsBase<IngestAddCompanyFromScraperOptions>

/**
 * IPC result for ingest:add-company-from-scraper.
 */
export type IngestAddCompanyFromScraperResult = IngestAddCompanyResult
