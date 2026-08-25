/**
 * Reader window contracts.
 *
 * A reader window is opened by an activity handler with a prepared bootstrap:
 * the entry, its ordered readable units, and where to start. The window pulls
 * that bootstrap once over IPC, drives one of the two reading engines, and
 * reports position facts back; every read-state decision stays in the
 * activity handlers.
 */

import type { ComicReadingDirection } from './db/contracts/enums'
import type { PagedContainer, DocumentContainer } from './media-info'

export interface ReaderComicUnit {
  id: string
  label: string
  read: boolean
  /** Zero-based page index to resume at; null when read or never opened. */
  resumePage: number | null
  /** Primary readable file; null when the unit has no file yet. */
  fileId: string | null
  pageCount: number | null
  /** Container kind as probed; decides which page source the engine uses. */
  container: PagedContainer | null
}

export interface ReaderComicBootstrap {
  kind: 'comic'
  comicId: string
  title: string
  /** Effective page flow, resolved from the entry override and format default. */
  pageFlow: ComicReadingDirection
  units: ReaderComicUnit[]
  startUnitId: string
}

export interface ReaderNovelUnit {
  id: string
  label: string
  read: boolean
  /** Engine-scoped resume locator (EPUB CFI or page locator); opaque here. */
  resumeLocator: string | null
  resumeProgress: number | null
  /** Primary readable file; null when the volume has no file yet. */
  fileId: string | null
  /** Container kind as probed; PDF volumes render through the page engine. */
  container: DocumentContainer | null
}

export interface ReaderNovelBootstrap {
  kind: 'novel'
  novelId: string
  title: string
  units: ReaderNovelUnit[]
  startUnitId: string
}

export type ReaderBootstrap = ReaderComicBootstrap | ReaderNovelBootstrap

/** Position fact of one comic page turn. */
export interface ReaderComicProgressReport {
  chapterId: string
  /** Zero-based index of the page currently displayed. */
  pageIndex: number
  /** Page count of the file being read, as the engine sees it. */
  pageCount: number
}

/** Position fact of one novel relocation. */
export interface ReaderNovelProgressReport {
  volumeId: string
  /** Engine-scoped locator to resume from (EPUB CFI or text fraction). */
  locator: string
  /** Overall fraction in [0, 1] for display. */
  progress: number
}

/** Fired by the reader when it switches to another unit inside the window. */
export interface ReaderUnitOpenedReport {
  unitId: string
}
