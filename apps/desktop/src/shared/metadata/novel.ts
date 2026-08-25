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

/** Numbering a novel volume can be identified by, whether stated or stored. */
export interface NovelUnitNumbering {
  volumeNumber?: number | null
  name?: string | null
}

/** Whether the volume states a number the library can identify it by. */
export function isNumberedNovelVolume(unit: NovelUnitNumbering): boolean {
  return unit.volumeNumber != null
}

/**
 * Identity of one volume within its novel.
 *
 * The single source of truth for volume identity: ingest, file sync, entity
 * merge, and the `unique_novel_volumes_number` index must all agree.
 * Unnumbered volumes fall back to their name, which is what keeps a named
 * side story from being re-inserted on every re-scrape.
 */
export function novelUnitIdentityKey(unit: NovelUnitNumbering): string {
  return unit.volumeNumber != null ? `volume:${unit.volumeNumber}` : `name:${unit.name ?? ''}`
}
