/**
 * Reading coordinator.
 *
 * One home for the mechanics of reading any media in a reader window: the
 * window→session ledger, segment timing, throttled resume flushes, the
 * once-per-read-through read counting, and the ordering that flushes and
 * records before a session ends. What varies by media — tables, vocabulary,
 * push channels — lives in the two adapters; reading media are a closed pair
 * (comic, novel), so the shared flow is a fact rather than a speculation.
 *
 * Read criteria follow the position's coordinate system, not the media: a
 * page coordinate finishes on the last page, a text coordinate on a fraction
 * threshold. A novel PDF therefore finishes exactly like a comic archive.
 */

import { existsSync } from 'node:fs'

import { createLogger } from '@main/log'
import type { ReaderService } from '@main/services/reader'
import type {
  ComicReadingState,
  NovelReadingState,
  ReadingResult,
  ReadingStopResult
} from '@shared/activity'
import { COMIC_READING_DIRECTION_VALUES, type ComicReadingDirection } from '@shared/db/contracts/enums'
import type { ReaderBootstrap, ReaderProgressReport, ReaderUnit, ReadingMedia } from '@shared/reader'

const log = createLogger('Activity')

/** Persisting a resume point on every relocation is waste. */
const RESUME_WRITE_INTERVAL_MS = 5_000

/** Below this, a session segment is a mis-click rather than reading time. */
const MIN_READING_SEGMENT_MS = 5_000

/**
 * Fraction of a text continuum that counts as read.
 *
 * Books end with colophons and previews, so demanding the final position
 * would leave most finished volumes unread. Page coordinates finish on the
 * last page instead — a page sequence has no trailing matter to forgive.
 */
const TEXT_READ_PROGRESS = 0.98

/** Unit numbers are real: keep the decimals a source stated, drop none. */
export function formatUnitNumber(value: number): string {
  return String(value)
}

/** Matching inside the unit's own files keeps ownership validated. */
export function electUnitFile<T extends { id: string; isPrimary: boolean }>(
  files: T[],
  requestedFileId: string | undefined
): T | null {
  if (requestedFileId) return files.find((file) => file.id === requestedFileId) ?? null
  return files.find((file) => file.isPrimary) ?? files[0] ?? null
}

/** Entry facts the reader window needs before it opens. */
export interface ReadingEntry {
  title: string
  /** Effective page flow for image-rendered units. */
  pageFlow: ComicReadingDirection
}

export interface ReadingUnitList {
  units: ReaderUnit[]
  /** Stored path of each elected unit file, keyed by file id. */
  filePaths: Map<string, string>
}

/**
 * Table mapping and vocabulary of one reading media. Adapters hold every
 * database write and outward push; the coordinator decides when they happen.
 */
export interface ReadingAdapter {
  readonly media: ReadingMedia
  /** Entry facts, or null when no entry claims the id. */
  readEntry(entryId: string): ReadingEntry | null
  /** Ordered reader units of the entry, with per-unit elected files. */
  readUnits(entryId: string, requestedFileId?: string): ReadingUnitList
  /** Stamps activity and infers the guarded planned→active transition. */
  markEntryActive(entryId: string, at: Date): void
  /** Persists one reported position as the unit's resume point. */
  writeResume(report: ReaderProgressReport): void
  /** Marks a unit read and clears its resume point. */
  markUnitRead(unitId: string): void
  /** Records one finished session segment against the entry. */
  recordSegment(entryId: string, unitId: string, startedAt: Date, endedAt: Date): void
  /** Persists the reader's page-flow choice; absent when the media stores none. */
  persistPageFlow?(entryId: string, pageFlow: ComicReadingDirection): void
  notifyStarted(entryId: string, unitId: string): void
  notifyUnitChanged(entryId: string, unitId: string): void
  /** Announces the ended session: the stopped push and the ended hook. */
  notifyEnded(entryId: string, unitId: string, readTimeSeconds: number): void
}

interface ReadingSession {
  media: ReadingMedia
  entryId: string
  /** Unit of the current per-unit session segment. */
  unitId: string
  segmentStartedAt: number
  lastResumeWriteAt: number
  /** Newest position the throttle held back; flushed before the session moves on. */
  pendingReport: ReaderProgressReport | null
  /** Units already counted as read here, so one read-through counts once. */
  countedUnitIds: Set<string>
  /** Reading time of the segments recorded so far in this window. */
  accumulatedMs: number
}

export class ReadingCoordinator {
  /** Reading sessions started here, keyed by reader window id. */
  private readonly sessions = new Map<number, ReadingSession>()

  constructor(
    private readonly reader: ReaderService,
    private readonly adapters: Record<ReadingMedia, ReadingAdapter>
  ) {
    this.tapReaderHooks()
  }

  /**
   * Starts reading an entry.
   *
   * Without a unit the next unread one with a readable file is chosen, which
   * is what pressing read on the entry itself means. A file id narrows
   * reading to that specific version instead of the primary election.
   */
  read(media: ReadingMedia, entryId: string, unitId?: string, fileId?: string): ReadingResult {
    const adapter = this.adapters[media]

    const entry = adapter.readEntry(entryId)
    if (!entry) {
      log.warn('Entry to read was not found.', { media, entryId })
      return { status: 'failed', reason: 'entryNotFound' }
    }

    const { units, filePaths } = adapter.readUnits(entryId, fileId)
    const startUnit = unitId
      ? units.find((unit) => unit.id === unitId)
      : (units.find((unit) => !unit.read && unit.fileId) ?? units.find((unit) => unit.fileId))
    if (!startUnit) {
      return { status: 'failed', reason: unitId ? 'unitNotFound' : 'noReadableUnit' }
    }

    const startPath = startUnit.fileId ? filePaths.get(startUnit.fileId) : undefined
    if (!startPath) {
      log.warn('Reading unit has no readable file.', { media, entryId, unitId: startUnit.id })
      return { status: 'failed', reason: 'noUnitFile' }
    }
    if (!existsSync(startPath)) {
      log.warn('Reading unit file is missing on disk.', { media, entryId, unitId: startUnit.id })
      return { status: 'failed', reason: 'fileNotFound' }
    }

    const bootstrap: ReaderBootstrap = {
      media,
      entryId,
      title: entry.title,
      pageFlow: entry.pageFlow,
      units,
      startUnitId: startUnit.id
    }

    const opened = this.reader.windows.open(`${media}:${entryId}`, bootstrap)
    if (opened.reused) {
      // The window was re-aimed and reports the unit it lands on, which moves
      // the running session; repeating the started event would be a lie.
      log.info('Reader refocused.', { media, entryId, unitId: startUnit.id })
      return { status: 'refocused', unitId: startUnit.id }
    }

    const now = Date.now()
    this.sessions.set(opened.windowId, {
      media,
      entryId,
      unitId: startUnit.id,
      segmentStartedAt: now,
      lastResumeWriteAt: 0,
      pendingReport: null,
      countedUnitIds: new Set(),
      accumulatedMs: 0
    })

    adapter.markEntryActive(entryId, new Date(now))

    log.info('Reading started.', { media, entryId, unitId: startUnit.id })
    adapter.notifyStarted(entryId, startUnit.id)

    return { status: 'started', unitId: startUnit.id }
  }

  /**
   * Stops reading by closing the entry's reader window.
   *
   * The session ends before the close so the stopped push (and the state it
   * clears) lands ahead of the IPC reply, like the other activity stops; the
   * closing window's remaining reports find no session and are dropped.
   */
  stop(media: ReadingMedia, entryId: string): ReadingStopResult {
    for (const [windowId, session] of this.sessions) {
      if (session.media !== media || session.entryId !== entryId) continue
      this.endSession(windowId)
      this.reader.windows.close(windowId)
      return { status: 'stopped' }
    }
    return { status: 'failed', reason: 'notReading' }
  }

  /** Live comic reading states, letting a reloaded renderer resynchronize. */
  listComicReading(): ComicReadingState[] {
    return this.statesOf('comic').map(({ entryId, unitId }) => ({
      comicId: entryId,
      chapterId: unitId
    }))
  }

  /** Live novel reading states, letting a reloaded renderer resynchronize. */
  listNovelReading(): NovelReadingState[] {
    return this.statesOf('novel').map(({ entryId, unitId }) => ({
      novelId: entryId,
      volumeId: unitId
    }))
  }

  dispose(): void {
    // Reader windows are torn down by the reader service; recording here keeps
    // the sessions read so far even on app quit.
    for (const [windowId] of this.sessions) {
      this.endSession(windowId)
    }
  }

  private statesOf(media: ReadingMedia): { entryId: string; unitId: string }[] {
    return [...this.sessions.values()]
      .filter((session) => session.media === media)
      .map((session) => ({ entryId: session.entryId, unitId: session.unitId }))
  }

  /** Translates reported positions into resume points and read state. */
  private tapReaderHooks(): void {
    this.reader.hooks.progress.tap(({ windowId, report }) => {
      const session = this.sessions.get(windowId)
      if (!session || report.unitId !== session.unitId) return
      this.handleProgress(session, report)
    })

    this.reader.hooks.unitOpened.tap(({ windowId, report }) => {
      const session = this.sessions.get(windowId)
      if (!session || session.unitId === report.unitId) return
      // A window may only claim units from the bootstrap prepared for it.
      if (!this.isWindowUnit(windowId, session.media, report.unitId)) return

      this.flushResume(session)
      this.recordSegment(session)
      session.unitId = report.unitId
      session.segmentStartedAt = Date.now()
      session.lastResumeWriteAt = 0
      // Unit-scoped read buttons key their live state on the unit being read.
      this.adapters[session.media].notifyUnitChanged(session.entryId, report.unitId)
    })

    this.reader.hooks.pageFlowChanged.tap(({ windowId, report }) => {
      const session = this.sessions.get(windowId)
      if (!session) return

      const pageFlow = parsePageFlow(report.pageFlow)
      if (!pageFlow) {
        log.warn('Reader reported an unknown page flow.', { pageFlow: String(report.pageFlow) })
        return
      }
      this.adapters[session.media].persistPageFlow?.(session.entryId, pageFlow)
    })

    this.reader.hooks.windowClosed.tap(({ windowId }) => {
      this.endSession(windowId)
    })
  }

  private isWindowUnit(windowId: number, media: ReadingMedia, unitId: string): boolean {
    const bootstrap = this.reader.windows.getBootstrap(windowId)
    if (!bootstrap || bootstrap.media !== media) return false
    return bootstrap.units.some((unit) => unit.id === unitId)
  }

  private handleProgress(session: ReadingSession, report: ReaderProgressReport): void {
    if (isFinishedPosition(report)) {
      this.markUnitRead(session, report.unitId)
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
    this.adapters[session.media].writeResume(report)
  }

  /**
   * Marks a unit read once per read-through: the session remembers what it
   * counted, so lingering at the end counts once while opening the unit
   * again later is a genuine re-read.
   */
  private markUnitRead(session: ReadingSession, unitId: string): void {
    if (session.countedUnitIds.has(unitId)) return
    session.countedUnitIds.add(unitId)
    session.pendingReport = null
    this.adapters[session.media].markUnitRead(unitId)
  }

  private endSession(windowId: number): void {
    const session = this.sessions.get(windowId)
    if (!session) return

    this.sessions.delete(windowId)
    this.flushResume(session)
    this.recordSegment(session)

    log.info('Reading ended.', { media: session.media, entryId: session.entryId })
    this.adapters[session.media].notifyEnded(
      session.entryId,
      session.unitId,
      Math.floor(session.accumulatedMs / 1000)
    )
  }

  /** Records the current per-unit segment; too-short segments are mis-clicks. */
  private recordSegment(session: ReadingSession): void {
    const endedAt = Date.now()
    const elapsedMs = endedAt - session.segmentStartedAt
    if (elapsedMs < MIN_READING_SEGMENT_MS) return

    session.accumulatedMs += elapsedMs
    this.adapters[session.media].recordSegment(
      session.entryId,
      session.unitId,
      new Date(session.segmentStartedAt),
      new Date(endedAt)
    )
  }
}

/** Whether a reported position finishes its unit, by coordinate system. */
function isFinishedPosition(report: ReaderProgressReport): boolean {
  const { position, extent } = report
  if (position.kind === 'page') {
    return extent !== null && extent > 0 && position.index >= extent - 1
  }
  return position.fraction >= TEXT_READ_PROGRESS
}

/** Reads an IPC-reported page flow back into its union; unknown is null. */
function parsePageFlow(value: unknown): ComicReadingDirection | null {
  return (COMIC_READING_DIRECTION_VALUES as readonly unknown[]).includes(value)
    ? (value as ComicReadingDirection)
    : null
}
