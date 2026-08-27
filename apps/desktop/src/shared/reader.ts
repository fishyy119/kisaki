/**
 * Reader window contracts.
 *
 * A reader window is opened by the reading coordinator with a prepared
 * bootstrap: the entry, its ordered readable units, and where to start. The
 * window pulls that bootstrap once over IPC, drives one of the two reading
 * engines, and reports position facts back; every read-state decision stays
 * in the main process.
 *
 * Positions are coordinate facts scoped by engine: image containers address
 * whole pages by index, text containers address a continuum by locator and
 * fraction. The reader reports where it is; what a position means belongs to
 * the coordinator.
 */

import type { ComicReadingDirection } from './db/contracts/enums'
import type { DocumentContainer, PagedContainer } from './book'

/** Media served by reader windows; a closed pair by design. */
export type ReadingMedia = 'comic' | 'novel'

/** Engine-scoped reading position. */
export type ReadingPosition =
  | {
      kind: 'page'
      /** Zero-based index into the unit's page sequence. */
      index: number
    }
  | {
      kind: 'text'
      /** Engine locator to resume from (EPUB CFI). */
      locator: string
      /** Overall fraction in [0, 1] for display and read-state policy. */
      fraction: number
    }

export interface ReaderUnit {
  id: string
  label: string
  read: boolean
  /** Primary readable file; null when the unit has no file yet. */
  fileId: string | null
  /** Container kind as probed; decides which engine renders the unit. */
  container: PagedContainer | DocumentContainer | null
  /** Position to resume at; null when read or never opened. */
  resume: ReadingPosition | null
}

export interface ReaderBootstrap {
  media: ReadingMedia
  entryId: string
  title: string
  /**
   * Effective page flow for image-rendered units: the comic entry override
   * wins over its format default; novel volumes read left-to-right.
   */
  pageFlow: ComicReadingDirection
  units: ReaderUnit[]
  startUnitId: string
}

/** Position fact of one relocation, whichever engine produced it. */
export interface ReaderProgressReport {
  unitId: string
  position: ReadingPosition
  /** Page count of the open unit as the engine sees it; null for text. */
  extent: number | null
}

/** Fired by the reader when it switches to another unit inside the window. */
export interface ReaderUnitOpenedReport {
  unitId: string
}

/** Page-flow choice made while reading, persisted as the comic entry override. */
export interface ReaderPageFlowReport {
  pageFlow: ComicReadingDirection
}

// =============================================================================
// Position column serialization
// =============================================================================

/**
 * Text locator columns hold either an engine locator (EPUB CFI) or a page
 * position written in a shape that can never be mistaken for one. Both sides
 * of the IPC seam read and write this format, so it lives with the contract.
 */
const PAGE_LOCATOR_PREFIX = 'page:'

export function formatPageLocator(pageIndex: number): string {
  return `${PAGE_LOCATOR_PREFIX}${pageIndex}`
}

/** Zero-based page of a stored locator; null when it is not one. */
export function parsePageLocator(locator: string | null): number | null {
  if (!locator?.startsWith(PAGE_LOCATOR_PREFIX)) return null

  const parsed = Number.parseInt(locator.slice(PAGE_LOCATOR_PREFIX.length), 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}
