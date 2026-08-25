/**
 * Novel Activity Handler
 *
 * Owns the novel reading workflow: picking the volume and file to read,
 * opening the reader window, and turning reported locators into read state
 * and reading sessions. The reader supplies position facts; every domain
 * decision and database write lives here.
 */

import { existsSync } from 'node:fs'
import { and, asc, eq, sql } from 'drizzle-orm'

import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { IpcService } from '@main/services/ipc'
import type { ReaderService } from '@main/services/reader'
import {
  novelSessions,
  novelVolumeFiles,
  novelVolumes,
  novels,
  type NovelVolume,
  type NovelVolumeFile
} from '@shared/db'
import type { NovelReadResult, NovelReadingState } from '@shared/activity'
import { parseDocumentContainer } from '@shared/book'
import type {
  ReaderNovelBootstrap,
  ReaderNovelProgressReport,
  ReaderNovelUnit
} from '@shared/reader'
import type { ActivityHooks } from '../hooks'
import {
  MIN_READING_SEGMENT_MS,
  NOVEL_READ_PROGRESS,
  RESUME_WRITE_INTERVAL_MS,
  formatUnitNumber
} from './reading'

const log = createLogger('Activity')

interface ReadingSession {
  novelId: string
  volumeId: string
  /** Start of the current per-volume session segment. */
  segmentStartedAt: number
  lastResumeWriteAt: number
  /** Newest position the throttle held back; flushed before the session moves on. */
  pendingReport: ReaderNovelProgressReport | null
  /** Units already counted as read here, so one read-through counts once. */
  countedUnitIds: Set<string>
  /** Reading time of the segments recorded so far in this window. */
  accumulatedMs: number
}

export class NovelActivityHandler {
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
   * Starts reading a novel.
   *
   * Without a volume the next unread one with a readable file is chosen. A
   * file id narrows reading to that specific version instead of the primary
   * election.
   */
  read(novelId: string, volumeId?: string, fileId?: string): NovelReadResult {
    const novel = this.db.client.select().from(novels).where(eq(novels.id, novelId)).get()
    if (!novel) {
      log.warn('Novel to read was not found.', { novelId })
      return { status: 'failed', reason: 'novelNotFound' }
    }

    const volumes = this.readVolumes(novelId)
    const filesByVolume = this.readVolumeFiles(novelId)
    const electedFiles = new Map<string, NovelVolumeFile>()
    const units = volumes.map((volume) => {
      const file = electFile(filesByVolume.get(volume.id) ?? [], fileId)
      if (file) electedFiles.set(volume.id, file)
      return this.toReaderUnit(volume, file)
    })

    const startUnit = volumeId
      ? units.find((unit) => unit.id === volumeId)
      : (units.find((unit) => !unit.read && unit.fileId) ?? units.find((unit) => unit.fileId))
    if (!startUnit) {
      return { status: 'failed', reason: volumeId ? 'volumeNotFound' : 'noReadableVolume' }
    }

    const startFile = electedFiles.get(startUnit.id)
    if (!startFile) {
      log.warn('Novel volume has no readable file.', { novelId, volumeId: startUnit.id })
      return { status: 'failed', reason: 'noVolumeFile' }
    }
    if (!existsSync(startFile.path)) {
      log.warn('Novel volume file is missing on disk.', { novelId, volumeId: startUnit.id })
      return { status: 'failed', reason: 'fileNotFound' }
    }

    const bootstrap: ReaderNovelBootstrap = {
      kind: 'novel',
      novelId,
      title: novel.name,
      units,
      startUnitId: startUnit.id
    }

    const opened = this.reader.windows.open(`novel:${novelId}`, bootstrap)
    if (opened.reused) {
      // The window was re-aimed and reports the unit it lands on, which moves
      // the running session; repeating the started event would be a lie.
      log.info('Novel reader refocused.', { novelId, volumeId: startUnit.id })
      return { status: 'refocused', volumeId: startUnit.id }
    }

    const now = Date.now()
    this.reading.set(opened.windowId, {
      novelId,
      volumeId: startUnit.id,
      segmentStartedAt: now,
      lastResumeWriteAt: 0,
      pendingReport: null,
      countedUnitIds: new Set(),
      accumulatedMs: 0
    })

    this.db.client
      .update(novels)
      .set({ lastActiveAt: new Date(now) })
      .where(eq(novels.id, novelId))
      .run()
    // Starting to read is the only status transition reading infers, guarded so
    // a user edit is never clobbered. Completion stays a user declaration.
    this.db.client
      .update(novels)
      .set({ status: 'reading' })
      .where(and(eq(novels.id, novelId), eq(novels.status, 'planned')))
      .run()

    log.info('Novel reading started.', { novelId, volumeId: startUnit.id })
    this.ipc.send('activity:novel-started', { novelId, volumeId: startUnit.id })
    this.hooks.novelReadStarted.dispatch({ novelId, volumeId: startUnit.id })

    return { status: 'started', volumeId: startUnit.id }
  }

  /** Live reading states, letting a reloaded renderer resynchronize. */
  listReading(): NovelReadingState[] {
    return [...this.reading.values()].map((session) => ({
      novelId: session.novelId,
      volumeId: session.volumeId
    }))
  }

  dispose(): void {
    for (const [windowId] of this.reading) {
      this.endSession(windowId)
    }
  }

  /** Translates reported locators into resume points and read state. */
  private tapReaderHooks(): void {
    this.reader.hooks.novelProgress.tap(({ windowId, report }) => {
      const session = this.reading.get(windowId)
      if (!session) return
      this.handleProgress(session, report)
    })

    this.reader.hooks.unitOpened.tap(({ windowId, report }) => {
      const session = this.reading.get(windowId)
      if (!session || session.volumeId === report.unitId) return
      // A window may only claim units from the bootstrap prepared for it.
      if (!this.isWindowUnit(windowId, report.unitId)) return

      this.flushResume(session)
      this.recordSegment(session)
      session.volumeId = report.unitId
      session.segmentStartedAt = Date.now()
      session.lastResumeWriteAt = 0
    })

    this.reader.hooks.windowClosed.tap(({ windowId }) => {
      this.endSession(windowId)
    })
  }

  private isWindowUnit(windowId: number, unitId: string): boolean {
    const bootstrap = this.reader.windows.getBootstrap(windowId)
    if (bootstrap?.kind !== 'novel') return false
    return bootstrap.units.some((unit) => unit.id === unitId)
  }

  private handleProgress(session: ReadingSession, report: ReaderNovelProgressReport): void {
    if (report.volumeId !== session.volumeId) return

    if (report.progress >= NOVEL_READ_PROGRESS) {
      this.markUnitRead(session, report.volumeId)
      return
    }

    session.pendingReport = report
    if (Date.now() - session.lastResumeWriteAt < RESUME_WRITE_INTERVAL_MS) return
    this.flushResume(session)
  }

  /** Persists the newest held-back position, so no relocation is lost. */
  private flushResume(session: ReadingSession): void {
    const report = session.pendingReport
    if (!report) return

    session.pendingReport = null
    session.lastResumeWriteAt = Date.now()

    this.db.client
      .update(novelVolumes)
      .set({
        resumeLocator: report.locator || null,
        resumeProgress: clampFraction(report.progress)
      })
      .where(eq(novelVolumes.id, report.volumeId))
      .run()
  }

  /**
   * Marks a volume read once per read-through: the session remembers what it
   * counted, so drifting across the end threshold counts once while opening
   * the volume again later is a genuine re-read.
   */
  private markUnitRead(session: ReadingSession, volumeId: string): void {
    if (session.countedUnitIds.has(volumeId)) return
    session.countedUnitIds.add(volumeId)
    session.pendingReport = null

    this.db.client
      .update(novelVolumes)
      .set({
        read: true,
        readAt: new Date(),
        readCount: sql`${novelVolumes.readCount} + 1`,
        resumeLocator: null,
        resumeProgress: null
      })
      .where(eq(novelVolumes.id, volumeId))
      .run()
  }

  private endSession(windowId: number): void {
    const session = this.reading.get(windowId)
    if (!session) return

    this.reading.delete(windowId)
    this.flushResume(session)
    this.recordSegment(session)

    log.info('Novel reading ended.', { novelId: session.novelId })
    this.ipc.send('activity:novel-stopped', {
      novelId: session.novelId,
      volumeId: session.volumeId
    })
    this.hooks.novelReadEnded.dispatch({
      novelId: session.novelId,
      readTimeSeconds: Math.floor(session.accumulatedMs / 1000)
    })
  }

  /** Records the current per-volume segment; too-short segments are mis-clicks. */
  private recordSegment(session: ReadingSession): void {
    const endedAt = Date.now()
    const elapsedMs = endedAt - session.segmentStartedAt
    if (elapsedMs < MIN_READING_SEGMENT_MS) return

    session.accumulatedMs += elapsedMs

    this.db.client.transaction((tx) => {
      tx.insert(novelSessions)
        .values({
          novelId: session.novelId,
          volumeId: session.volumeId,
          startedAt: new Date(session.segmentStartedAt),
          endedAt: new Date(endedAt)
        })
        .run()

      tx.update(novels)
        .set({
          lastActiveAt: new Date(endedAt),
          totalDuration: sql`${novels.totalDuration} + ${elapsedMs}`
        })
        .where(eq(novels.id, session.novelId))
        .run()
    })
  }

  private toReaderUnit(volume: NovelVolume, file: NovelVolumeFile | null): ReaderNovelUnit {
    return {
      id: volume.id,
      label: formatVolumeLabel(this.i18n, volume),
      read: volume.read,
      resumeLocator: volume.resumeLocator,
      resumeProgress: volume.resumeProgress,
      fileId: file?.id ?? null,
      container: parseDocumentContainer(file?.container ?? null)
    }
  }

  private readVolumes(novelId: string): NovelVolume[] {
    return this.db.client
      .select()
      .from(novelVolumes)
      .where(eq(novelVolumes.novelId, novelId))
      .orderBy(asc(novelVolumes.orderInNovel), asc(novelVolumes.createdAt))
      .all()
  }

  private readVolumeFiles(novelId: string): Map<string, NovelVolumeFile[]> {
    const rows = this.db.client
      .select({ file: novelVolumeFiles })
      .from(novelVolumeFiles)
      .innerJoin(novelVolumes, eq(novelVolumeFiles.volumeId, novelVolumes.id))
      .where(eq(novelVolumes.novelId, novelId))
      .orderBy(asc(novelVolumeFiles.createdAt))
      .all()

    const grouped = new Map<string, NovelVolumeFile[]>()
    for (const { file } of rows) {
      const bucket = grouped.get(file.volumeId)
      if (bucket) bucket.push(file)
      else grouped.set(file.volumeId, [file])
    }

    return grouped
  }
}

/** Matching inside the volume's own files keeps ownership validated. */
function electFile(
  files: NovelVolumeFile[],
  requestedFileId: string | undefined
): NovelVolumeFile | null {
  if (requestedFileId) return files.find((file) => file.id === requestedFileId) ?? null
  return files.find((file) => file.isPrimary) ?? files[0] ?? null
}

/** Reader-facing volume label: name when present, otherwise the volume number. */
function formatVolumeLabel(i18n: I18nService, volume: NovelVolume): string {
  if (volume.name) return volume.name

  const labels = i18n.messages.novel.volumes
  if (volume.volumeNumber !== null) {
    return labels.unnamed({ number: formatUnitNumber(volume.volumeNumber) })
  }
  return labels.entityLabel
}

function clampFraction(value: number): number | null {
  if (!Number.isFinite(value)) return null
  return Math.min(1, Math.max(0, value))
}
