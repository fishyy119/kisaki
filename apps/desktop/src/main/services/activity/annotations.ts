/**
 * Reading marks: bookmarks and highlights made while reading.
 *
 * Marks are made from reader windows, which know nothing about the library, so
 * every call is checked against the bootstrap the calling window was opened
 * with: a window may only mark units of the entry it is reading. Lists are
 * taken per entry, because that is what a reader window can prove it owns.
 */

import { and, asc, eq } from 'drizzle-orm'

import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { ReaderService } from '@main/services/reader'
import {
  comicBookmarks,
  comicChapters,
  novelBookmarks,
  novelHighlights,
  novelVolumes,
  type ComicBookmark,
  type NovelBookmark,
  type NovelHighlight
} from '@shared/db'
import type {
  ComicBookmarkInput,
  ComicBookmarkUpdate,
  NovelBookmarkInput,
  NovelBookmarkUpdate,
  NovelHighlightInput,
  NovelHighlightUpdate
} from '@shared/activity'

const log = createLogger('Activity')

export class ReadingAnnotations {
  constructor(
    private readonly db: DbService,
    private readonly reader: ReaderService
  ) {}

  listNovelBookmarks(windowId: number, novelId: string): NovelBookmark[] {
    this.requireNovelEntry(windowId, novelId)

    return this.db.client
      .select({ bookmark: novelBookmarks })
      .from(novelBookmarks)
      .innerJoin(novelVolumes, eq(novelBookmarks.volumeId, novelVolumes.id))
      .where(eq(novelVolumes.novelId, novelId))
      .orderBy(asc(novelVolumes.orderInNovel), asc(novelBookmarks.progress))
      .all()
      .map((row) => row.bookmark)
  }

  listNovelHighlights(windowId: number, novelId: string): NovelHighlight[] {
    this.requireNovelEntry(windowId, novelId)

    return this.db.client
      .select({ highlight: novelHighlights })
      .from(novelHighlights)
      .innerJoin(novelVolumes, eq(novelHighlights.volumeId, novelVolumes.id))
      .where(eq(novelVolumes.novelId, novelId))
      .orderBy(asc(novelVolumes.orderInNovel), asc(novelHighlights.progress))
      .all()
      .map((row) => row.highlight)
  }

  listComicBookmarks(windowId: number, comicId: string): ComicBookmark[] {
    this.requireComicEntry(windowId, comicId)

    return this.db.client
      .select({ bookmark: comicBookmarks })
      .from(comicBookmarks)
      .innerJoin(comicChapters, eq(comicBookmarks.chapterId, comicChapters.id))
      .where(eq(comicChapters.comicId, comicId))
      .orderBy(asc(comicChapters.orderInComic), asc(comicBookmarks.pageIndex))
      .all()
      .map((row) => row.bookmark)
  }

  createNovelBookmark(windowId: number, input: NovelBookmarkInput): NovelBookmark {
    this.requireNovelUnit(windowId, input.volumeId)

    const created = this.db.client.insert(novelBookmarks).values(input).returning().get()
    log.info('Novel bookmark added.', { volumeId: input.volumeId })
    return created
  }

  createNovelHighlight(windowId: number, input: NovelHighlightInput): NovelHighlight {
    this.requireNovelUnit(windowId, input.volumeId)

    const created = this.db.client.insert(novelHighlights).values(input).returning().get()
    log.info('Novel highlight added.', { volumeId: input.volumeId })
    return created
  }

  /**
   * Marks a comic page, or unmarks it when it already is.
   *
   * A page is either marked or not, so the reader's one action is a toggle and
   * the unique index on (chapter, page) is the fact that decides which way it
   * goes.
   * @returns The new mark, or null when the page was unmarked.
   */
  toggleComicBookmark(windowId: number, input: ComicBookmarkInput): ComicBookmark | null {
    this.requireComicUnit(windowId, input.chapterId)

    const existing = this.db.client
      .select()
      .from(comicBookmarks)
      .where(
        and(
          eq(comicBookmarks.chapterId, input.chapterId),
          eq(comicBookmarks.pageIndex, input.pageIndex)
        )
      )
      .get()

    if (existing) {
      this.db.client.delete(comicBookmarks).where(eq(comicBookmarks.id, existing.id)).run()
      return null
    }

    const created = this.db.client.insert(comicBookmarks).values(input).returning().get()
    log.info('Comic bookmark added.', { chapterId: input.chapterId })
    return created
  }

  updateNovelBookmark(windowId: number, id: string, updates: NovelBookmarkUpdate): void {
    this.requireNovelUnit(windowId, this.requireNovelBookmarkVolume(id))
    this.db.client.update(novelBookmarks).set(updates).where(eq(novelBookmarks.id, id)).run()
  }

  updateNovelHighlight(windowId: number, id: string, updates: NovelHighlightUpdate): void {
    this.requireNovelUnit(windowId, this.requireNovelHighlightVolume(id))
    this.db.client.update(novelHighlights).set(updates).where(eq(novelHighlights.id, id)).run()
  }

  updateComicBookmark(windowId: number, id: string, updates: ComicBookmarkUpdate): void {
    this.requireComicUnit(windowId, this.requireComicBookmarkChapter(id))
    this.db.client.update(comicBookmarks).set(updates).where(eq(comicBookmarks.id, id)).run()
  }

  deleteNovelBookmark(windowId: number, id: string): void {
    this.requireNovelUnit(windowId, this.requireNovelBookmarkVolume(id))
    this.db.client.delete(novelBookmarks).where(eq(novelBookmarks.id, id)).run()
  }

  deleteNovelHighlight(windowId: number, id: string): void {
    this.requireNovelUnit(windowId, this.requireNovelHighlightVolume(id))
    this.db.client.delete(novelHighlights).where(eq(novelHighlights.id, id)).run()
  }

  deleteComicBookmark(windowId: number, id: string): void {
    this.requireComicUnit(windowId, this.requireComicBookmarkChapter(id))
    this.db.client.delete(comicBookmarks).where(eq(comicBookmarks.id, id)).run()
  }

  private requireNovelBookmarkVolume(id: string): string {
    const row = this.db.client
      .select({ volumeId: novelBookmarks.volumeId })
      .from(novelBookmarks)
      .where(eq(novelBookmarks.id, id))
      .get()
    if (!row) throw new Error(`Novel bookmark ${id} was not found.`)
    return row.volumeId
  }

  private requireNovelHighlightVolume(id: string): string {
    const row = this.db.client
      .select({ volumeId: novelHighlights.volumeId })
      .from(novelHighlights)
      .where(eq(novelHighlights.id, id))
      .get()
    if (!row) throw new Error(`Novel highlight ${id} was not found.`)
    return row.volumeId
  }

  private requireComicBookmarkChapter(id: string): string {
    const row = this.db.client
      .select({ chapterId: comicBookmarks.chapterId })
      .from(comicBookmarks)
      .where(eq(comicBookmarks.id, id))
      .get()
    if (!row) throw new Error(`Comic bookmark ${id} was not found.`)
    return row.chapterId
  }

  /** A reader window may only mark units of the entry it was opened for. */
  private requireNovelUnit(windowId: number, volumeId: string): void {
    const bootstrap = this.reader.windows.getBootstrap(windowId)
    if (bootstrap?.kind !== 'novel' || !bootstrap.units.some((unit) => unit.id === volumeId)) {
      throw new Error(`Window ${windowId} is not reading novel volume ${volumeId}.`)
    }
  }

  private requireComicUnit(windowId: number, chapterId: string): void {
    const bootstrap = this.reader.windows.getBootstrap(windowId)
    if (bootstrap?.kind !== 'comic' || !bootstrap.units.some((unit) => unit.id === chapterId)) {
      throw new Error(`Window ${windowId} is not reading comic unit ${chapterId}.`)
    }
  }

  private requireNovelEntry(windowId: number, novelId: string): void {
    const bootstrap = this.reader.windows.getBootstrap(windowId)
    if (bootstrap?.kind !== 'novel' || bootstrap.novelId !== novelId) {
      throw new Error(`Window ${windowId} is not reading novel ${novelId}.`)
    }
  }

  private requireComicEntry(windowId: number, comicId: string): void {
    const bootstrap = this.reader.windows.getBootstrap(windowId)
    if (bootstrap?.kind !== 'comic' || bootstrap.comicId !== comicId) {
      throw new Error(`Window ${windowId} is not reading comic ${comicId}.`)
    }
  }
}
