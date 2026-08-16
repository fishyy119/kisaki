/**
 * TV Metadata Types
 *
 * Core metadata type definitions for television shows.
 */

import type { ExternalSite, PartialDate, TvFormat } from '@shared/db'
import type { ExternalId, Tag } from './common'

// =============================================================================
// Core Info
// =============================================================================

/**
 * Core TV info.
 *
 * Basic fields returned by scraper providers for the info slot.
 */
export interface TvInfo {
  name: string
  originalName?: string
  releaseDate?: PartialDate
  /** Last air date; absent while the show is still running. */
  endDate?: PartialDate
  description?: string
  format?: TvFormat
  /** Counts declared by the source; stored season and episode rows stay authoritative. */
  totalSeasons?: number
  totalEpisodes?: number
  externalSites?: ExternalSite[]
  externalIds: ExternalId[]
}

/**
 * Core TV metadata used across identity and normalization layers.
 */
export interface CoreTvMetadata extends TvInfo {
  tags?: Tag[]
}

/**
 * One season as stated by a source.
 *
 * Seasons are addressed by number rather than external id: the number is the
 * one key every source agrees on, and a season carries no user data that a
 * realignment could lose.
 */
export interface TvSeasonInfo {
  /** Season 0 holds specials; regular seasons start at 1. */
  number: number
  name?: string
  originalName?: string
  airDate?: PartialDate
  description?: string
  totalEpisodes?: number
}

/**
 * One episode as stated by a source.
 *
 * Episode identity travels with the episode so a re-scrape realigns existing
 * rows by external id instead of by number, which sources revise.
 */
export interface TvEpisodeInfo {
  /** Season the episode belongs to; 0 for specials. */
  seasonNumber: number
  number: number
  name?: string
  originalName?: string
  airDate?: PartialDate
  description?: string
  durationMs?: number
  externalIds?: ExternalId[]
}
