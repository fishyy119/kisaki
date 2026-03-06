/**
 * Ingest contracts for person add orchestration.
 */

import type { CorePersonMetadata } from '@shared/metadata'
import type {
  IngestAddPersonResult,
  IngestAddPersonFromScraperOptions,
  IngestEntityNode,
  IngestFromScraperParamsBase
} from './common'

/**
 * Person node in normalized ingest graph.
 */
export interface IngestPersonNode extends IngestEntityNode<CorePersonMetadata> {
  photoUrls?: string[]
}

/**
 * Canonical normalized graph produced by ingest for person flow.
 */
export interface IngestPersonGraph {
  person: IngestPersonNode
}

/**
 * IPC params for ingest:add-person-from-scraper.
 */
export type IngestAddPersonFromScraperParams =
  IngestFromScraperParamsBase<IngestAddPersonFromScraperOptions>

/**
 * IPC result for ingest:add-person-from-scraper.
 */
export type IngestAddPersonFromScraperResult = IngestAddPersonResult
