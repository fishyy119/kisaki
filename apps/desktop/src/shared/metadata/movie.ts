/**
 * Movie Metadata Types
 *
 * Core metadata type definitions for feature films.
 */

import type { ExternalSite, MovieFormat, PartialDate } from '@shared/db'
import type { ExternalId, Tag } from './common'

// =============================================================================
// Core Info
// =============================================================================

/**
 * Core movie info.
 *
 * Basic fields returned by scraper providers for the info slot.
 */
export interface MovieInfo {
  name: string
  originalName?: string
  releaseDate?: PartialDate
  description?: string
  format?: MovieFormat
  /** Runtime declared by the source; probed file durations stay authoritative. */
  runtimeMs?: number
  externalSites?: ExternalSite[]
  externalIds: ExternalId[]
}

/**
 * Core movie metadata used across identity and normalization layers.
 */
export interface CoreMovieMetadata extends MovieInfo {
  tags?: Tag[]
}
