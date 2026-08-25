/**
 * Comic Metadata Types
 *
 * Core metadata type definitions for comic entities.
 */

import type { ComicFormat, PartialDate, ExternalSite } from '@shared/db'
import type { ExternalId, Tag } from './common'

// =============================================================================
// Core Info
// =============================================================================

/**
 * Core comic info.
 *
 * Basic fields returned by scraper providers for the info slot.
 */
export interface ComicInfo {
  name: string
  originalName?: string
  /** Other titles this entry is known by, such as localized names and abbreviations. */
  aliases?: string[]
  releaseDate?: PartialDate
  description?: string
  format?: ComicFormat
  /** Volume count declared by the source; stored unit rows stay authoritative. */
  totalVolumes?: number
  /** Chapter count declared by the source; stored unit rows stay authoritative. */
  totalChapters?: number
  externalSites?: ExternalSite[]
  externalIds: ExternalId[]
}

/**
 * Core comic metadata used across identity and normalization layers.
 */
export interface CoreComicMetadata extends ComicInfo {
  tags?: Tag[]
}

/**
 * One readable unit as stated by a source, at either grain: a collected
 * volume carries `volumeNumber`, a serialized chapter carries `chapterNumber`
 * (plus its volume when known).
 *
 * Unit identity travels with the unit so a re-scrape realigns existing rows by
 * external id instead of by number, which sources revise.
 */
export interface ComicChapterInfo {
  volumeNumber?: number
  chapterNumber?: number
  name?: string
  originalName?: string
  releaseDate?: PartialDate
  description?: string
  externalIds?: ExternalId[]
}
