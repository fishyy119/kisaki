/**
 * Anime Metadata Types
 *
 * Core metadata type definitions for anime entities.
 */

import type { AnimeEpisodeType, AnimeFormat, PartialDate, ExternalSite } from '@shared/db'
import type { ExternalId, Tag } from './common'

// =============================================================================
// Core Info
// =============================================================================

/**
 * Core anime info.
 *
 * Basic fields returned by scraper providers for the info slot.
 */
export interface AnimeInfo {
  name: string
  originalName?: string
  releaseDate?: PartialDate
  description?: string
  format?: AnimeFormat
  /** Episode count declared by the source; stored episode rows stay authoritative. */
  totalEpisodes?: number
  externalSites?: ExternalSite[]
  externalIds: ExternalId[]
}

/**
 * Core anime metadata used across identity and normalization layers.
 */
export interface CoreAnimeMetadata extends AnimeInfo {
  tags?: Tag[]
}

/**
 * One episode as stated by a source.
 *
 * Episode identity travels with the episode so a re-scrape realigns existing
 * rows by external id instead of by number, which sources revise.
 */
export interface AnimeEpisodeInfo {
  number: number
  type: AnimeEpisodeType
  name?: string
  originalName?: string
  airDate?: PartialDate
  description?: string
  durationMs?: number
  externalIds?: ExternalId[]
}
