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
  originalName?: string | undefined
  /** Other titles this entry is known by, such as localized names and abbreviations. */
  aliases?: string[] | undefined
  releaseDate?: PartialDate | undefined
  description?: string | undefined
  format?: ComicFormat | undefined
  /** Volume count declared by the source; stored unit rows stay authoritative. */
  totalVolumes?: number | undefined
  /** Chapter count declared by the source; stored unit rows stay authoritative. */
  totalChapters?: number | undefined
  externalSites?: ExternalSite[] | undefined
  externalIds: ExternalId[]
}

/**
 * Core comic metadata used across identity and normalization layers.
 */
export interface CoreComicMetadata extends ComicInfo {
  tags?: Tag[] | undefined
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
  volumeNumber?: number | undefined
  chapterNumber?: number | undefined
  name?: string | undefined
  originalName?: string | undefined
  releaseDate?: PartialDate | undefined
  description?: string | undefined
  /** Cover art of this installment (tankobon art), not a page render. */
  coverUrl?: string | undefined
  externalIds?: ExternalId[] | undefined
}

/** Numbering a comic unit can be identified by, whether stated or stored. */
export interface ComicUnitNumbering {
  volumeNumber?: number | null
  chapterNumber?: number | null
  name?: string | null
}

/** Whether the unit states a number the library can identify it by. */
export function isNumberedComicUnit(unit: ComicUnitNumbering): boolean {
  return unit.volumeNumber != null || unit.chapterNumber != null
}

/**
 * Identity of one comic unit within its entry, at the unit's own grain.
 *
 * The single source of truth for comic unit identity: ingest, file sync,
 * entity merge, and the `unique_comic_chapters_numbering` index must all
 * agree, because a key the application treats as new but the index treats as
 * taken aborts the whole write.
 *
 * A chapter keys on its full numbering because chapter numbers restart per
 * volume in works collected straight to volumes. Unnumbered units fall back to
 * their name, which is what keeps a named extra from being re-inserted on
 * every re-scrape.
 */
export function comicUnitIdentityKey(unit: ComicUnitNumbering): string {
  if (unit.chapterNumber != null) {
    return `chapter:${unit.volumeNumber ?? ''}:${unit.chapterNumber}`
  }
  if (unit.volumeNumber != null) return `volume:${unit.volumeNumber}`
  return `name:${unit.name ?? ''}`
}

/**
 * Whether two chapter-grain units are the same installment seen with
 * different volume knowledge.
 *
 * Sources learn (or forget) which volume collected a chapter, and that must
 * realign the existing row rather than insert a second one. It only holds when
 * one side is silent about the volume: two chapters that both state a volume
 * and disagree are genuinely different units under per-volume numbering.
 *
 * Callers must additionally require the match to be unique — with per-volume
 * numbering a volume-less chapter 5 is ambiguous between every volume's fifth
 * chapter, and guessing one would corrupt the other.
 */
export function isSameChapterAcrossVolumeKnowledge(
  left: ComicUnitNumbering,
  right: ComicUnitNumbering
): boolean {
  if (left.chapterNumber == null || left.chapterNumber !== right.chapterNumber) return false
  return left.volumeNumber == null || right.volumeNumber == null
}
