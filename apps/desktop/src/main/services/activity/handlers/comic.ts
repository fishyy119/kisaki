/**
 * Comic Activity Handler
 *
 * Owns the comic reading workflow: picking the unit and file to read, opening
 * the reader window, and turning reported page positions into read state and
 * reading sessions. The reader supplies position facts; every domain decision
 * and database write lives here.
 */

import { existsSync } from 'node:fs'
import { and, asc, eq, sql } from 'drizzle-orm'

import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { IpcService } from '@main/services/ipc'
import type { ReaderService } from '@main/services/reader'
import {
  comicChapterFiles,
  comicChapters,
  comicSessions,
  comics,
  type ComicChapter,
  type ComicChapterFile
} from '@shared/db'
import type { ComicReadResult, ComicReadingState } from '@shared/activity'
import { parsePagedContainer } from '@shared/book'
import type {
  ReaderComicBootstrap,
  ReaderComicProgressReport,
  ReaderComicUnit
} from '@shared/reader'
import type { ActivityHooks } from '../hooks'
import {
  MIN_READING_SEGMENT_MS,
  RESUME_WRITE_INTERVAL_MS,
  formatUnitNumber,
  resolveComicPageFlow
} from './reading'

const log = createLogger('Activity')

interface ReadingSession {
  comicId: string
  chapterId: string
  /** Start of the current per-unit session segment. */
  segmentStartedAt: number
  lastResumeWriteAt: number
  /** Newest position the throttle held back; flushed before the session moves on. */
  pendingReport: ReaderComicProgressReport | null
  /** Units already counted as read here, so one read-through counts once. */
  countedUnitIds: Set<string>
  /** Reading time of the segments recorded so far in this window. */
  accumulatedMs: number
}

export class ComicActivityHandler {
  /** Reading sessions started by this handler, keyed by reader window id. */
  private readonly reading = new Map<number, ReadingSession>()

  constructor(
    private readonly db: DbService,
    private readonly reader: ReaderService,
    private readonly i18n: I18nService,
    private readonly ipc: IpcService,
    private readonly hooks: ActivityHooks
  ) {
    this.tapReaderHooks()
  }

  /**
   * Starts reading a comic.
   *
   * Without a unit the next unread one with a readable file is chosen, which
   * is what pressing read on the entry itself means. A file id narrows
   * reading to that specific version instead of the primary election.
   */
  read(comicId: string, chapterId?: string, fileId?: string): ComicReadResult {
    const comic = this.db.client.select().from(comics).where(eq(comics.id, comicId)).get()
    if (!comic) {
      log.warn('Comic to read was not found.', { comicId })
      return { status: 'failed', reason: 'comicNotFound' }
    }

    const chapters = this.readChapters(comicId)
    const filesByChapter = this.readChapterFiles(comicId)
    const electedFiles = new Map<string, ComicChapterFile>()
    const units = chapters.map((chapter) => {
      const file = electFile(filesByChapter.get(chapter.id) ?? [], fileId)
      if (file) electedFiles.set(chapter.id, file)
      return this.toReaderUnit(chapter, file)
    })

    const startUnit = chapterId
      ? units.find((unit) => unit.id === chapterId)
      : (units.find((unit) => !unit.read && unit.fileId) ?? units.find((unit) => unit.fileId))
    if (!startUnit) {
      return { status: 'failed', reason: chapterId ? 'chapterNotFound' : 'noReadableChapter' }
    }

    const startFile = electedFiles.get(startUnit.id)
    if (!startFile) {
      log.warn('Comic unit has no readable file.', { comicId, chapterId: startUnit.id })
      return { status: 'failed', reason: 'noChapterFile' }
    }
    if (!existsSync(startFile.path)) {
      log.warn('Comic unit file is missing on disk.', { comicId, chapterId: startUnit.id })
      return { status: 'failed', reason: 'fileNotFound' }
    }

    const bootstrap: ReaderComicBootstrap = {
      kind: 'comic',
      comicId,
      title: comic.name,
      pageFlow: resolveComicPageFlow(comic.readingDirection, comic.format),
      units,
      startUnitId: startUnit.id
    }

    const opened = this.reader.windows.open(`comic:${comicId}`, bootstrap)
    if (opened.reused) {
      // The window was re-aimed and reports the unit it lands on, which moves
      // the running session; repeating the started event would be a lie.
      log.info('Comic reader refocused.', { comicId, chapterId: startUnit.id })
      return { status: 'refocused', chapterId: startUnit.id }
    }

    const now = Date.now()
    this.reading.set(opened.windowId, {
      comicId,
      chapterId: startUnit.id,
      segmentStartedAt: now,
      lastResumeWriteAt: 0,
      pendingReport: null,
      countedUnitIds: new Set(),
      accumulatedMs: 0
    })

    this.db.client
      .update(comics)
      .set({ lastActiveAt: new Date(now) })
      .where(eq(comics.id, comicId))
      .run()
    // Starting to read is the only status transition reading infers, guarded so
    // a user edit is never clobbered. Completion stays a user declaration.
    this.db.client
      .update(comics)
      .set({ status: 'reading' })
      .where(and(eq(comics.id, comicId), eq(comics.status, 'planned')))
      .run()

    log.info('Comic reading started.', { comicId, chapterId: startUnit.id })
    this.ipc.send('activity:comic-started', { comicId, chapterId: startUnit.id })
    this.hooks.comicReadStarted.dispatch({ comicId, chapterId: startUnit.id })

    return { status: 'started', chapterId: startUnit.id }
  }

  /** Live reading states, letting a reloaded renderer resynchronize. */
  listReading(): ComicReadingState[] {
    return [...this.reading.values()].map((session) => ({
      comicId: session.comicId,
      chapterId: session.chapterId
    }))
  }

  dispose(): void {
    // Reader windows are torn down by the reader service; recording here keeps
    // the sessions read so far even on app quit.
    for (const [windowId] of this.reading) {
      this.endSession(windowId)
    }
  }

  /** Translates reported page positions into resume points and read state. */
  private tapReaderHooks(): void {
    this.reader.hooks.comicProgress.tap(({ windowId, report }) => {
      const session = this.reading.get(windowId)
      if (!session) return
      this.handleProgress(session, report)
    })

    this.reader.hooks.unitOpened.tap(({ windowId, report }) => {
      const session = this.reading.get(windowId)
      if (!session || session.chapterId === report.unitId) return
      // A window may only claim units from the bootstrap prepared for it.
      if (!this.isWindowUnit(windowId, report.unitId)) return

      this.flushResume(session)
      this.recordSegment(session)
      session.chapterId = report.unitId
      session.segmentStartedAt = Date.now()
      session.lastResumeWriteAt = 0
    })

    this.reader.hooks.windowClosed.tap(({ windowId }) => {
      this.endSession(windowId)
    })
  }

  private isWindowUnit(windowId: number, unitId: string): boolean {
    const bootstrap = this.reader.windows.getBootstrap(windowId)
    if (bootstrap?.kind !== 'comic') return false
    return bootstrap.units.some((unit) => unit.id === unitId)
  }

  private handleProgress(session: ReadingSession, report: ReaderComicProgressReport): void {
    if (report.chapterId !== session.chapterId) return

    const finished = report.pageCount > 0 && report.pageIndex >= report.pageCount - 1
    if (finished) {
      this.markUnitRead(session, report.chapterId)
      return
    }

    session.pendingReport = report
    if (Date.now() - session.lastResumeWriteAt < RESUME_WRITE_INTERVAL_MS) return
    this.flushResume(session)
  }

  /** Persists the newest held-back position, so no page turn is lost. */
  private flushResume(session: ReadingSession): void {
    const report = session.pendingReport
    if (!report) return

    session.pendingReport = null
    session.lastResumeWriteAt = Date.now()

    this.db.client
      .update(comicChapters)
      .set({ resumePage: report.pageIndex > 0 ? report.pageIndex : null })
      .where(eq(comicChapters.id, report.chapterId))
      .run()
  }

  /**
   * Marks a unit read once per read-through: the session remembers what it
   * counted, so lingering on the last page counts once while opening the unit
   * again later is a genuine re-read.
   */
  private markUnitRead(session: ReadingSession, chapterId: string): void {
    if (session.countedUnitIds.has(chapterId)) return
    session.countedUnitIds.add(chapterId)
    session.pendingReport = null

    this.db.client
      .update(comicChapters)
      .set({
        read: true,
        readAt: new Date(),
        readCount: sql`${comicChapters.readCount} + 1`,
        resumePage: null
      })
      .where(eq(comicChapters.id, chapterId))
      .run()
  }

  private endSession(windowId: number): void {
    const session = this.reading.get(windowId)
    if (!session) return

    this.reading.delete(windowId)
    this.flushResume(session)
    this.recordSegment(session)

    log.info('Comic reading ended.', { comicId: session.comicId })
    this.ipc.send('activity:comic-stopped', {
      comicId: session.comicId,
      chapterId: session.chapterId
    })
    this.hooks.comicReadEnded.dispatch({
      comicId: session.comicId,
      readTimeSeconds: Math.floor(session.accumulatedMs / 1000)
    })
  }

  /** Records the current per-unit segment; too-short segments are mis-clicks. */
  private recordSegment(session: ReadingSession): void {
    const endedAt = Date.now()
    const elapsedMs = endedAt - session.segmentStartedAt
    if (elapsedMs < MIN_READING_SEGMENT_MS) return

    session.accumulatedMs += elapsedMs

    this.db.client.transaction((tx) => {
      tx.insert(comicSessions)
        .values({
          comicId: session.comicId,
          chapterId: session.chapterId,
          startedAt: new Date(session.segmentStartedAt),
          endedAt: new Date(endedAt)
        })
        .run()

      tx.update(comics)
        .set({
          lastActiveAt: new Date(endedAt),
          totalDuration: sql`${comics.totalDuration} + ${elapsedMs}`
        })
        .where(eq(comics.id, session.comicId))
        .run()
    })
  }

  private toReaderUnit(chapter: ComicChapter, file: ComicChapterFile | null): ReaderComicUnit {
    return {
      id: chapter.id,
      label: formatChapterLabel(this.i18n, chapter),
      read: chapter.read,
      resumePage: chapter.resumePage,
      fileId: file?.id ?? null,
      pageCount: file?.pageCount ?? null,
      container: parsePagedContainer(file?.container ?? null)
    }
  }

  private readChapters(comicId: string): ComicChapter[] {
    return this.db.client
      .select()
      .from(comicChapters)
      .where(eq(comicChapters.comicId, comicId))
      .orderBy(asc(comicChapters.orderInComic), asc(comicChapters.createdAt))
      .all()
  }

  private readChapterFiles(comicId: string): Map<string, ComicChapterFile[]> {
    const rows = this.db.client
      .select({ file: comicChapterFiles })
      .from(comicChapterFiles)
      .innerJoin(comicChapters, eq(comicChapterFiles.chapterId, comicChapters.id))
      .where(eq(comicChapters.comicId, comicId))
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

/** Matching inside the unit's own files keeps ownership validated. */
function electFile(
  files: ComicChapterFile[],
  requestedFileId: string | undefined
): ComicChapterFile | null {
  if (requestedFileId) return files.find((file) => file.id === requestedFileId) ?? null
  return files.find((file) => file.isPrimary) ?? files[0] ?? null
}

/** Reader-facing unit label: name when present, otherwise the unit number. */
function formatChapterLabel(i18n: I18nService, chapter: ComicChapter): string {
  if (chapter.name) return chapter.name

  const labels = i18n.messages.comic.chapters
  if (chapter.chapterNumber !== null) {
    return labels.unnamedChapter({ number: formatUnitNumber(chapter.chapterNumber) })
  }
  if (chapter.volumeNumber !== null) {
    return labels.unnamedVolume({ number: formatUnitNumber(chapter.volumeNumber) })
  }
  return labels.entityLabel
}
