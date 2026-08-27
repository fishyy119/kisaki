/**
 * Comic table mapping for the reading coordinator: chapters as reader units,
 * page-coordinate resume points, the entry's page-flow override, and the
 * comic-worded pushes and hooks. Flow and policy live in the coordinator.
 */

import { and, asc, eq, sql } from 'drizzle-orm'

import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { IpcService } from '@main/services/ipc'
import {
  comicChapterFiles,
  comicChapters,
  comicSessions,
  comics,
  type ComicChapter,
  type ComicChapterFile
} from '@shared/db'
import type { ComicFormat, ComicReadingDirection } from '@shared/db/contracts/enums'
import { parsePagedContainer } from '@shared/book'
import type { ReaderProgressReport, ReaderUnit } from '@shared/reader'
import type { ActivityHooks } from '../hooks'
import {
  electUnitFile,
  formatUnitNumber,
  type ReadingAdapter,
  type ReadingEntry,
  type ReadingUnitList
} from './coordinator'

const log = createLogger('Activity')

export class ComicReadingAdapter implements ReadingAdapter {
  readonly media = 'comic' as const

  constructor(
    private readonly db: DbService,
    private readonly i18n: I18nService,
    private readonly ipc: IpcService,
    private readonly hooks: ActivityHooks
  ) {}

  readEntry(entryId: string): ReadingEntry | null {
    const comic = this.db.client.select().from(comics).where(eq(comics.id, entryId)).get()
    if (!comic) return null
    return { title: comic.name, pageFlow: resolvePageFlow(comic.readingDirection, comic.format) }
  }

  readUnits(entryId: string, requestedFileId?: string): ReadingUnitList {
    const filesByChapter = this.readChapterFiles(entryId)
    const filePaths = new Map<string, string>()

    const units = this.readChapters(entryId).map((chapter) => {
      const file = electUnitFile(filesByChapter.get(chapter.id) ?? [], requestedFileId)
      if (file) filePaths.set(file.id, file.path)
      return this.toReaderUnit(chapter, file)
    })

    return { units, filePaths }
  }

  markEntryActive(entryId: string, at: Date): void {
    this.db.client.update(comics).set({ lastActiveAt: at }).where(eq(comics.id, entryId)).run()
    // Starting to read is the only status transition reading infers, guarded so
    // a user edit is never clobbered. Completion stays a user declaration.
    this.db.client
      .update(comics)
      .set({ status: 'active' })
      .where(and(eq(comics.id, entryId), eq(comics.status, 'planned')))
      .run()
  }

  writeResume(report: ReaderProgressReport): void {
    if (report.position.kind !== 'page') return

    this.db.client
      .update(comicChapters)
      .set({ resumePage: report.position.index > 0 ? report.position.index : null })
      .where(eq(comicChapters.id, report.unitId))
      .run()
  }

  markUnitRead(unitId: string): void {
    this.db.client
      .update(comicChapters)
      .set({
        read: true,
        readAt: new Date(),
        readCount: sql`${comicChapters.readCount} + 1`,
        resumePage: null
      })
      .where(eq(comicChapters.id, unitId))
      .run()
  }

  recordSegment(entryId: string, unitId: string, startedAt: Date, endedAt: Date): void {
    const elapsedMs = endedAt.getTime() - startedAt.getTime()

    this.db.client.transaction((tx) => {
      tx.insert(comicSessions)
        .values({ comicId: entryId, chapterId: unitId, startedAt, endedAt })
        .run()

      tx.update(comics)
        .set({
          lastActiveAt: endedAt,
          totalDuration: sql`${comics.totalDuration} + ${elapsedMs}`
        })
        .where(eq(comics.id, entryId))
        .run()
    })
  }

  /** The reader's page-flow choice becomes the entry override, so it sticks. */
  persistPageFlow(entryId: string, pageFlow: ComicReadingDirection): void {
    this.db.client
      .update(comics)
      .set({ readingDirection: pageFlow })
      .where(eq(comics.id, entryId))
      .run()
    log.info('Comic page flow persisted.', { comicId: entryId, pageFlow })
  }

  notifyStarted(entryId: string, unitId: string): void {
    this.ipc.send('activity:comic-started', { comicId: entryId, chapterId: unitId })
    this.hooks.comicReadStarted.dispatch({ comicId: entryId, chapterId: unitId })
  }

  notifyUnitChanged(entryId: string, unitId: string): void {
    this.ipc.send('activity:comic-unit-changed', { comicId: entryId, chapterId: unitId })
  }

  notifyEnded(entryId: string, unitId: string, readTimeSeconds: number): void {
    this.ipc.send('activity:comic-stopped', { comicId: entryId, chapterId: unitId })
    this.hooks.comicReadEnded.dispatch({ comicId: entryId, readTimeSeconds })
  }

  private toReaderUnit(chapter: ComicChapter, file: ComicChapterFile | null): ReaderUnit {
    return {
      id: chapter.id,
      label: this.formatChapterLabel(chapter),
      read: chapter.read,
      fileId: file?.id ?? null,
      container: parsePagedContainer(file?.container ?? null),
      resume: chapter.resumePage !== null ? { kind: 'page', index: chapter.resumePage } : null
    }
  }

  /** Reader-facing unit label: name when present, otherwise the unit number. */
  private formatChapterLabel(chapter: ComicChapter): string {
    if (chapter.name) return chapter.name

    const labels = this.i18n.messages.comic.chapters
    if (chapter.chapterNumber !== null) {
      return labels.unnamedChapter({ number: formatUnitNumber(chapter.chapterNumber) })
    }
    if (chapter.volumeNumber !== null) {
      return labels.unnamedVolume({ number: formatUnitNumber(chapter.volumeNumber) })
    }
    return labels.entityLabel
  }

  private readChapters(entryId: string): ComicChapter[] {
    return this.db.client
      .select()
      .from(comicChapters)
      .where(eq(comicChapters.comicId, entryId))
      .orderBy(asc(comicChapters.orderInComic), asc(comicChapters.createdAt))
      .all()
  }

  private readChapterFiles(entryId: string): Map<string, ComicChapterFile[]> {
    const rows = this.db.client
      .select({ file: comicChapterFiles })
      .from(comicChapterFiles)
      .innerJoin(comicChapters, eq(comicChapterFiles.chapterId, comicChapters.id))
      .where(eq(comicChapters.comicId, entryId))
      .orderBy(asc(comicChapterFiles.createdAt))
      .all()

    const grouped = new Map<string, ComicChapterFile[]>()
    for (const { file } of rows) {
      const bucket = grouped.get(file.chapterId)
      if (bucket) bucket.push(file)
      else grouped.set(file.chapterId, [file])
    }

    return grouped
  }
}

/**
 * Effective page flow of a comic entry: the per-entry override wins, the
 * format default follows (webtoons scroll vertically, manga pages
 * right-to-left, the rest left-to-right).
 */
function resolvePageFlow(
  readingDirection: ComicReadingDirection | null,
  format: ComicFormat
): ComicReadingDirection {
  if (readingDirection) return readingDirection
  if (format === 'webtoon') return 'vertical'
  if (format === 'manga' || format === 'doujinshi') return 'rtl'
  return 'ltr'
}
