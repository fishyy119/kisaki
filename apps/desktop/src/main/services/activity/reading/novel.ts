/**
 * Novel table mapping for the reading coordinator: volumes as reader units,
 * locator-column resume points in either coordinate system, and the
 * novel-worded pushes and hooks. Flow and policy live in the coordinator.
 */

import { and, asc, eq, sql } from 'drizzle-orm'

import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { IpcService } from '@main/services/ipc'
import {
  novelSessions,
  novelVolumeFiles,
  novelVolumes,
  novels,
  type NovelVolume,
  type NovelVolumeFile
} from '@shared/db'
import { parseDocumentContainer } from '@shared/book'
import {
  formatPageLocator,
  parsePageLocator,
  type ReaderProgressReport,
  type ReaderUnit,
  type ReadingPosition
} from '@shared/reader'
import type { ActivityHooks } from '../hooks'
import {
  electUnitFile,
  formatUnitNumber,
  type ReadingAdapter,
  type ReadingEntry,
  type ReadingUnitList
} from './coordinator'

export class NovelReadingAdapter implements ReadingAdapter {
  readonly media = 'novel' as const

  constructor(
    private readonly db: DbService,
    private readonly i18n: I18nService,
    private readonly ipc: IpcService,
    private readonly hooks: ActivityHooks
  ) {}

  readEntry(entryId: string): ReadingEntry | null {
    const novel = this.db.client.select().from(novels).where(eq(novels.id, entryId)).get()
    if (!novel) return null
    // Scanned volumes that read the other way flip in the reader per session.
    return { title: novel.name, pageFlow: 'ltr' }
  }

  readUnits(entryId: string, requestedFileId?: string): ReadingUnitList {
    const filesByVolume = this.readVolumeFiles(entryId)
    const filePaths = new Map<string, string>()

    const units = this.readVolumes(entryId).map((volume) => {
      const file = electUnitFile(filesByVolume.get(volume.id) ?? [], requestedFileId)
      if (file) filePaths.set(file.id, file.path)
      return this.toReaderUnit(volume, file)
    })

    return { units, filePaths }
  }

  markEntryActive(entryId: string, at: Date): void {
    this.db.client.update(novels).set({ lastActiveAt: at }).where(eq(novels.id, entryId)).run()
    // Starting to read is the only status transition reading infers, guarded so
    // a user edit is never clobbered. Completion stays a user declaration.
    this.db.client
      .update(novels)
      .set({ status: 'active' })
      .where(and(eq(novels.id, entryId), eq(novels.status, 'planned')))
      .run()
  }

  /**
   * Both coordinate systems land in the locator column: text positions as the
   * engine locator, page positions in the page shape the same column parses
   * back out. The stored fraction keeps the library's resume display honest.
   */
  writeResume(report: ReaderProgressReport): void {
    const { position, extent } = report
    const values =
      position.kind === 'page'
        ? {
            resumeLocator: formatPageLocator(position.index),
            resumeProgress:
              extent !== null && extent > 0 ? clampFraction((position.index + 1) / extent) : null
          }
        : {
            resumeLocator: position.locator || null,
            resumeProgress: clampFraction(position.fraction)
          }

    this.db.client
      .update(novelVolumes)
      .set(values)
      .where(eq(novelVolumes.id, report.unitId))
      .run()
  }

  markUnitRead(unitId: string): void {
    this.db.client
      .update(novelVolumes)
      .set({
        read: true,
        readAt: new Date(),
        readCount: sql`${novelVolumes.readCount} + 1`,
        resumeLocator: null,
        resumeProgress: null
      })
      .where(eq(novelVolumes.id, unitId))
      .run()
  }

  recordSegment(entryId: string, unitId: string, startedAt: Date, endedAt: Date): void {
    const elapsedMs = endedAt.getTime() - startedAt.getTime()

    this.db.client.transaction((tx) => {
      tx.insert(novelSessions)
        .values({ novelId: entryId, volumeId: unitId, startedAt, endedAt })
        .run()

      tx.update(novels)
        .set({
          lastActiveAt: endedAt,
          totalDuration: sql`${novels.totalDuration} + ${elapsedMs}`
        })
        .where(eq(novels.id, entryId))
        .run()
    })
  }

  notifyStarted(entryId: string, unitId: string): void {
    this.ipc.send('activity:novel-started', { novelId: entryId, volumeId: unitId })
    this.hooks.novelReadStarted.dispatch({ novelId: entryId, volumeId: unitId })
  }

  notifyUnitChanged(entryId: string, unitId: string): void {
    this.ipc.send('activity:novel-unit-changed', { novelId: entryId, volumeId: unitId })
  }

  notifyEnded(entryId: string, unitId: string, readTimeSeconds: number): void {
    this.ipc.send('activity:novel-stopped', { novelId: entryId, volumeId: unitId })
    this.hooks.novelReadEnded.dispatch({ novelId: entryId, readTimeSeconds })
  }

  private toReaderUnit(volume: NovelVolume, file: NovelVolumeFile | null): ReaderUnit {
    return {
      id: volume.id,
      label: this.formatVolumeLabel(volume),
      read: volume.read,
      fileId: file?.id ?? null,
      container: parseDocumentContainer(file?.container ?? null),
      resume: parseResumePosition(volume)
    }
  }

  /** Reader-facing volume label: name when present, otherwise the volume number. */
  private formatVolumeLabel(volume: NovelVolume): string {
    if (volume.name) return volume.name

    const labels = this.i18n.messages.novel.volumes
    if (volume.volumeNumber !== null) {
      return labels.unnamed({ number: formatUnitNumber(volume.volumeNumber) })
    }
    return labels.entityLabel
  }

  private readVolumes(entryId: string): NovelVolume[] {
    return this.db.client
      .select()
      .from(novelVolumes)
      .where(eq(novelVolumes.novelId, entryId))
      .orderBy(asc(novelVolumes.orderInNovel), asc(novelVolumes.createdAt))
      .all()
  }

  private readVolumeFiles(entryId: string): Map<string, NovelVolumeFile[]> {
    const rows = this.db.client
      .select({ file: novelVolumeFiles })
      .from(novelVolumeFiles)
      .innerJoin(novelVolumes, eq(novelVolumeFiles.volumeId, novelVolumes.id))
      .where(eq(novelVolumes.novelId, entryId))
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

/** Stored resume columns read back as a position, whichever engine wrote them. */
function parseResumePosition(volume: NovelVolume): ReadingPosition | null {
  const page = parsePageLocator(volume.resumeLocator)
  if (page !== null) return { kind: 'page', index: page }
  if (volume.resumeLocator) {
    return { kind: 'text', locator: volume.resumeLocator, fraction: volume.resumeProgress ?? 0 }
  }
  return null
}

function clampFraction(value: number): number | null {
  if (!Number.isFinite(value)) return null
  return Math.min(1, Math.max(0, value))
}
