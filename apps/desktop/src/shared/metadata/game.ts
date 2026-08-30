/**
 * Game Metadata Types
 *
 * Core metadata type definitions for game entities.
 */

import type { PartialDate, ExternalSite } from '@shared/db'
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
  originalName?: string | undefined
  /** Other titles this entry is known by, such as localized names and abbreviations. */
  aliases?: string[] | undefined
  releaseDate?: PartialDate | undefined
  description?: string | undefined
  externalSites?: ExternalSite[] | undefined
  externalIds: ExternalId[]
}

/**
 * Core game metadata used across identity and normalization layers.
 */
export interface CoreGameMetadata extends GameInfo {
  tags?: Tag[] | undefined
}
