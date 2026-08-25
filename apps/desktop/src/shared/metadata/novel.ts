/**
 * Novel Metadata Types
 *
 * Core metadata type definitions for novel entities.
 */

import type { NovelFormat, PartialDate, ExternalSite } from '@shared/db'
import type { ExternalId, Tag } from './common'

// =============================================================================
// Core Info
// =============================================================================

/**
 * Core novel info.
 *
 * Basic fields returned by scraper providers for the info slot.
 */
export interface NovelInfo {
  name: string
  originalName?: string
  /** Other titles this entry is known by, such as localized names and abbreviations. */
  aliases?: string[]
  releaseDate?: PartialDate
  description?: string
  format?: NovelFormat
  /** Volume count declared by the source; stored volume rows stay authoritative. */
  totalVolumes?: number
  externalSites?: ExternalSite[]
  externalIds: ExternalId[]
}

/**
 * Core novel metadata used across identity and normalization layers.
 */
export interface CoreNovelMetadata extends NovelInfo {
  tags?: Tag[]
}

/**
 * One volume as stated by a source.
 *
 * Volume identity travels with the volume so a re-scrape realigns existing
 * rows by external id instead of by number, which sources revise.
 */
export interface NovelVolumeInfo {
  volumeNumber?: number
  name?: string
  originalName?: string
  releaseDate?: PartialDate
  description?: string
  externalIds?: ExternalId[]
}
