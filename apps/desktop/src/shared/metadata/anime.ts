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
  originalName?: string | undefined
  /** Other titles this entry is known by, such as localized names and abbreviations. */
  aliases?: string[] | undefined
  releaseDate?: PartialDate | undefined
  description?: string | undefined
  format?: AnimeFormat | undefined
  /** Episode count declared by the source; stored episode rows stay authoritative. */
  totalEpisodes?: number | undefined
  externalSites?: ExternalSite[] | undefined
  externalIds: ExternalId[]
}

/**
 * Core anime metadata used across identity and normalization layers.
 */
export interface CoreAnimeMetadata extends AnimeInfo {
  tags?: Tag[] | undefined
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
  name?: string | undefined
  originalName?: string | undefined
  airDate?: PartialDate | undefined
  description?: string | undefined
  durationMs?: number | undefined
  /** Still frame of this episode from metadata, not a render of the local file. */
  stillUrl?: string | undefined
  externalIds?: ExternalId[] | undefined
}

/** Numbering an anime episode is identified by, whether stated or stored. */
export interface AnimeUnitNumbering {
  type: AnimeEpisodeType
  episodeNumber: number
}

/**
 * Identity of one numbered episode within its anime.
 *
 * The single source of truth for episode identity: ingest, file sync, and
 * entity merge must all agree. The type is part of the key because specials
 * carry their own sequence, so special 1 and episode 1 are different
 * installments. Unnumbered episodes have no identity of their own — what
 * proves them differs per consumer (a file path, or nothing at all) — so they
 * are keyed by their consumer and never reach this function.
 */
export function animeUnitIdentityKey(unit: AnimeUnitNumbering): string {
  return `${unit.type}:${unit.episodeNumber}`
}
