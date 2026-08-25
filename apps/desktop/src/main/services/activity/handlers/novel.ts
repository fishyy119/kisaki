/**
 * Novel Activity Handler
 *
 * Owns the novel reading workflow: picking the volume and file to read,
 * opening the reader window, and turning reported locators into read state
 * and reading sessions. The reader supplies position facts; every domain
 * decision and database write lives here.
 */

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
import type { ReaderNovelBootstrap, ReaderNovelProgressReport, ReaderNovelUnit } from '@shared/reader'
import type { ActivityHooks } from '../hooks'
import { MIN_READING_SEGMENT_MS, NOVEL_READ_PROGRESS, RESUME_WRITE_INTERVAL_MS } from './reading'

const log = createLogger('Activity')

interface ReadingSession {
  novelId: string
  volumeId: string
  /** Start of the current per-volume session segment. */
  segmentStartedAt: number
  lastResumeWriteAt: number
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
    const files = this.readVolumeFiles(volumes.map((volume) => volume.id))
    const units = volumes.map((volume) =>
      this.toReaderUnit(volume, files.get(volume.id) ?? [], fileId)
    )

    const startUnit = volumeId
      ? units.find((unit) => unit.id === volumeId)
      : (units.find((unit) => !unit.read && unit.fileId && unit.supported) ??
        units.find((unit) => unit.fileId && unit.supported))
    if (!startUnit) {
      return { status: 'failed', reason: volumeId ? 'volumeNotFound' : 'noReadableVolume' }
    }
    if (!startUnit.fileId) {
      log.warn('Novel volume has no readable file.', { novelId, volumeId: startUnit.id })
      return { status: 'failed', reason: 'noVolumeFile' }
    }
    if (!startUnit.supported) {
      log.warn('Novel volume file container is not renderable.', {
        novelId,
        volumeId: startUnit.id
      })
      return { status: 'failed', reason: 'unsupportedContainer' }
    }

    const bootstrap: ReaderNovelBootstrap = {
      kind: 'novel',
      novelId,
      title: novel.name,
      units,
      startUnitId: startUnit.id
    }

    const windowId = this.reader.windows.open(`novel:${novelId}`, bootstrap)
    const now = Date.now()

    if (!this.reading.has(windowId)) {
      this.reading.set(windowId, {
        novelId,
        volumeId: startUnit.id,
        segmentStartedAt: now,
        lastResumeWriteAt: 0
      })
    }

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

      this.recordSegment(session)
      session.volumeId = report.unitId
      session.segmentStartedAt = Date.now()
      session.lastResumeWriteAt = 0
    })

    this.reader.hooks.windowClosed.tap(({ windowId }) => {
      this.endSession(windowId)
    })
  }

  private handleProgress(session: ReadingSession, report: ReaderNovelProgressReport): void {
    if (report.volumeId !== session.volumeId) return

    const finished = report.progress >= NOVEL_READ_PROGRESS
    if (finished) {
      // The where-clause guard makes completion idempotent per read-through.
      this.db.client
        .update(novelVolumes)
        .set({
          read: true,
          readAt: new Date(),
          readCount: sql`${novelVolumes.readCount} + 1`,
          resumeLocator: null,
          resumeProgress: null
        })
        .where(and(eq(novelVolumes.id, report.volumeId), eq(novelVolumes.read, false)))
        .run()
      return
    }

    const now = Date.now()
    if (now - session.lastResumeWriteAt < RESUME_WRITE_INTERVAL_MS) return
    session.lastResumeWriteAt = now

    this.db.client
      .update(novelVolumes)
      .set({
        resumeLocator: report.locator || null,
        resumeProgress: clampFraction(report.progress)
      })
      .where(eq(novelVolumes.id, report.volumeId))
      .run()
  }

  private endSession(windowId: number): void {
    const session = this.reading.get(windowId)
    if (!session) return

    this.reading.delete(windowId)
    const elapsedMs = this.recordSegment(session)

    log.info('Novel reading ended.', { novelId: session.novelId })
    this.ipc.send('activity:novel-stopped', {
      novelId: session.novelId,
      volumeId: session.volumeId
    })
    this.hooks.novelReadEnded.dispatch({
      novelId: session.novelId,
      readTimeSeconds: Math.floor(elapsedMs / 1000)
    })
  }

  /** Records the current per-volume segment; too-short segments are mis-clicks. */
  private recordSegment(session: ReadingSession): number {
    const endedAt = Date.now()
    const elapsedMs = endedAt - session.segmentStartedAt
    if (elapsedMs < MIN_READING_SEGMENT_MS) {
      return 0
    }

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

    return elapsedMs
  }

  private toReaderUnit(
    volume: NovelVolume,
    files: NovelVolumeFile[],
    requestedFileId: string | undefined
  ): ReaderNovelUnit {
    // Matching inside the volume's own files keeps ownership validated.
    const requested = requestedFileId
      ? files.find((file) => file.id === requestedFileId)
      : undefined
    const file = requested ?? files.find((entry) => entry.isPrimary) ?? files[0]

    return {
      id: volume.id,
      label: formatVolumeLabel(this.i18n, volume),
      read: volume.read,
      resumeLocator: volume.resumeLocator,
      resumeProgress: volume.resumeProgress,
      fileId: file?.id ?? null,
      container: file?.container ?? null,
      supported: file ? file.container !== 'pdf' : false
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

  private readVolumeFiles(volumeIds: string[]): Map<string, NovelVolumeFile[]> {
    const grouped = new Map<string, NovelVolumeFile[]>()
    if (volumeIds.length === 0) return grouped

    const rows = this.db.client
      .select()
      .from(novelVolumeFiles)
      .orderBy(asc(novelVolumeFiles.createdAt))
      .all()

    const wanted = new Set(volumeIds)
    for (const row of rows) {
      if (!wanted.has(row.volumeId)) continue
      const bucket = grouped.get(row.volumeId)
      if (bucket) bucket.push(row)
      else grouped.set(row.volumeId, [row])
    }

    return grouped
  }
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

function formatUnitNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function clampFraction(value: number): number | null {
  if (!Number.isFinite(value)) return null
  return Math.min(1, Math.max(0, value))
}
