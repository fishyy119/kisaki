/**
 * Game Metadata Types
 *
 * Core metadata type definitions for game entities.
 */

import type { PartialDate, RelatedSite } from '@shared/db'
import type { ExternalId, Tag } from './common'

// =============================================================================
// Core Info
// =============================================================================

/**
 * Core game info.
 *
 * Basic fields returned by scraper providers for the info slot.
 */
export interface GameInfo {
  name: string
  originalName?: string
  releaseDate?: PartialDate
  description?: string
  relatedSites?: RelatedSite[]
  externalIds: ExternalId[]
}

/**
 * Core game metadata used across identity and normalization layers.
 */
export interface CoreGameMetadata extends GameInfo {
  tags?: Tag[]
}
