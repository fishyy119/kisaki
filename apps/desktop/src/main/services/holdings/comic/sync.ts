/**
 * Comic local file sync and manual file attachment.
 *
 * Sync reconciles the readable containers under a comic's library directory
 * with its unit and unit-file rows. Metadata scraped from a provider owns unit
 * identity and naming; this pass only attaches readable files to it and
 * creates rows for units the provider did not list.
 *
 * File rows have an owner: sync owns only the rows it created and the user
 * never touched. Rows marked `isManual` (attached or reassigned by the user)
 * may point anywhere on disk and are never re-probed, retargeted, deleted, or
 * stripped of their primary mark by a sync pass.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { createLogger } from '@main/log'
import type { DbContext, DbQueryContext, DbService } from '@main/services/db'
import type { BookContainerReader } from '@main/services/reader'
import { isProbeCurrent, readFileStat, readPrimaryElection, SyncPassQueue } from '../reconcile'
import {
  comicChapterFiles,
  comicChapters,
  comicSessions,
  comics,
  type ComicChapter,
  type ComicChapterFile,
  type NewComicChapter,
  type NewComicChapterFile
} from '@shared/db'
import type {
  ComicChapterFileAttachParams,
  ComicFileSyncParams,
  ComicFileSyncResult
} from '@shared/holdings'
import {
  comicUnitIdentityKey,
  isNumberedComicUnit,
  isSameChapterAcrossVolumeKnowledge
} from '@shared/metadata'
import { and, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import {
  isComicArchiveFile,
  isComicPageFile,
  recognizeComicUnit,
  type ComicUnitCandidate
} from './recognition'

const log = createLogger('Holdings')

/** Depth cap that covers `Comic/Volumes/…` layouts without deep walking. */
export const MAX_COMIC_WALK_DEPTH = 2

export interface ComicFileSyncOptions extends ComicFileSyncParams {
  signal?: AbortSignal
}

/** Column values a unit file row carries from one probe pass. */
interface ProbedUnitValues {
  fileSize: number | null
  fileMtime: Date | null
  container: string | null
  pageCount: number | null
}

interface ProbedUnitFile {
  candidate: ComicUnitCandidate
  values: ProbedUnitValues
}

/** Sort key that keeps volumes before chapters and numbers ascending. */
function unitSortKey(candidate: ComicUnitCandidate): [number, number, string] {
  const grain = candidate.chapterNumber !== undefined ? 1 : 0
  const number = candidate.chapterNumber ?? candidate.volumeNumber ?? Number.MAX_SAFE_INTEGER
  return [grain, number, candidate.fileName]
}

function compareUnits(a: ComicUnitCandidate, b: ComicUnitCandidate): number {
  const [aGrain, aNumber, aName] = unitSortKey(a)
  const [bGrain, bNumber, bName] = unitSortKey(b)
  if (aGrain !== bGrain) return aGrain - bGrain
  if (aNumber !== bNumber) return aNumber - bNumber
  return aName.localeCompare(bName)
}

/**
 * Identity of a candidate across sync runs.
 *
 * Numbered containers share their unit through the library-wide identity key;
 * unreadable names stay one unit per container, keyed by path, since two
 * unreadable names are not evidence of one unit.
 */
function unitCandidateKey(candidate: ComicUnitCandidate): string {
  return isNumberedComicUnit(candidate) ? comicUnitIdentityKey(candidate) : `file:${candidate.path}`
}

/** Identity key of a stored row; null for unnumbered rows, which key by file. */
function rowNumberKey(row: ComicChapter): string | null {
  return isNumberedComicUnit(row) ? comicUnitIdentityKey(row) : null
}

/**
 * The stored row is the same installment the filename now labels with (or
 * without) a volume. Only an unambiguous single candidate is claimed, so a
 * library numbering chapters per volume never cross-matches.
 */
function claimUnitAcrossVolumeKnowledge(
  candidate: ComicUnitCandidate,
  existingUnits: ComicChapter[],
  claimedUnitIds: ReadonlySet<string>
): ComicChapter | undefined {
  const matches = existingUnits.filter(
    (unit) => !claimedUnitIds.has(unit.id) && isSameChapterAcrossVolumeKnowledge(candidate, unit)
  )
  return matches.length === 1 ? matches[0] : undefined
}

export class ComicFileSyncHandler {
  private readonly passes = new SyncPassQueue<ComicFileSyncResult>()

  constructor(
    private readonly dbService: DbService,
    private readonly books: BookContainerReader
  ) {}

  async sync(params: ComicFileSyncOptions): Promise<ComicFileSyncResult> {
    return this.passes.run(params.comicId, () => this.runSync(params))
  }

  /**
   * Walk the comic directory and write what it finds.
   *
   * Probing runs outside the transaction because container listing is slow and
   * the write must stay a single synchronous better-sqlite3 unit.
   */
  private async runSync(params: ComicFileSyncOptions): Promise<ComicFileSyncResult> {
    const { comicId, signal } = params
    const dirPath = params.dirPath ?? this.readComicDirPath(comicId)

    if (!dirPath) {
      throw new Error('Comic has no library directory to scan')
    }

    const candidates = await this.walk(dirPath, signal)

    // Manual rows already claim their paths, so those containers leave the
    // candidate set entirely: sync neither re-probes nor re-assigns them.
    const manualPaths = new Set(this.readManualFiles(comicId).map((file) => file.path))
    const walkable = candidates.filter((candidate) => !manualPaths.has(candidate.path))
    walkable.sort(compareUnits)

    const storedProbes = this.readStoredProbes(comicId)

    const probed: ProbedUnitFile[] = []
    for (const candidate of walkable) {
      signal?.throwIfAborted()
      const values = await this.probeUnit(candidate.path, storedProbes)
      if (values) {
        probed.push({ candidate, values })
      }
    }

    return this.dbService.client.transaction((tx) => {
      const existingUnits = tx
        .select()
        .from(comicChapters)
        .where(eq(comicChapters.comicId, comicId))
        .all()
      const unitIds = existingUnits.map((unit) => unit.id)
      const existingFiles = unitIds.length
        ? tx
            .select()
            .from(comicChapterFiles)
            .where(inArray(comicChapterFiles.chapterId, unitIds))
            .all()
        : []

      const unitIdByKey = this.writeUnits(tx, comicId, probed, existingUnits, existingFiles)
      const fileCount = this.writeUnitFiles(tx, probed, unitIdByKey, existingFiles)
      this.deleteOrphanedFileBornUnits(tx, existingUnits, existingFiles, probed, unitIdByKey)

      return {
        chapterCount: unitIdByKey.size,
        fileCount,
        unrecognizedFiles: probed
          .filter(({ candidate }) => !isNumberedComicUnit(candidate))
          .map(({ candidate }) => candidate.path)
      }
    })
  }

  /**
   * Attach one container to a unit as a user-owned row.
   *
   * Probing runs before the write because container listing is slow; the row
   * is marked manual so sync passes leave it alone from now on.
   */
  async attachFile(params: ComicChapterFileAttachParams): Promise<void> {
    const { chapterId, path: filePath } = params

    const info = await this.books.probePagedContainer(filePath)
    if (!info) {
      throw new Error(`Comic unit file is not readable: ${filePath}`)
    }
    const stat = await readFileStat(filePath)

    this.dbService.client.transaction((tx) => {
      const [chapter] = tx
        .select()
        .from(comicChapters)
        .where(eq(comicChapters.id, chapterId))
        .limit(1)
        .all()
      if (!chapter) {
        throw new Error(`Comic unit not found: ${chapterId}`)
      }

      this.requirePathUnclaimed(tx, filePath)

      const siblings = tx
        .select({ id: comicChapterFiles.id })
        .from(comicChapterFiles)
        .where(eq(comicChapterFiles.chapterId, chapterId))
        .all()

      tx.insert(comicChapterFiles)
        .values({
          id: nanoid(),
          chapterId,
          path: filePath,
          fileSize: stat?.size ?? null,
          fileMtime: stat ? new Date(stat.mtimeMs) : null,
          container: info.container,
          pageCount: info.pageCount,
          isPrimary: siblings.length === 0,
          isManual: true
        })
        .run()
    })
  }

  /** Stored path of one unit file row, or null when no row claims that id. */
  findFilePath(fileId: string): string | null {
    const row = this.dbService.client
      .select({ path: comicChapterFiles.path })
      .from(comicChapterFiles)
      .where(eq(comicChapterFiles.id, fileId))
      .get()
    return row?.path ?? null
  }

  /** Throws when the path is already claimed by any unit file row. */
  private requirePathUnclaimed(tx: DbContext, filePath: string): void {
    const [claimed] = (tx as DbQueryContext)
      .select({ id: comicChapterFiles.id })
      .from(comicChapterFiles)
      .where(eq(comicChapterFiles.path, filePath))
      .limit(1)
      .all()
    if (claimed) {
      throw new Error(`File is already attached to a comic unit: ${filePath}`)
    }
  }

  private readComicDirPath(comicId: string): string | null {
    const [row] = this.dbService.client
      .select({ comicDirPath: comics.comicDirPath })
      .from(comics)
      .where(eq(comics.id, comicId))
      .limit(1)
      .all()

    return row?.comicDirPath ?? null
  }

  private readManualFiles(comicId: string): Array<{ path: string }> {
    return this.dbService.client
      .select({ path: comicChapterFiles.path })
      .from(comicChapterFiles)
      .innerJoin(comicChapters, eq(comicChapterFiles.chapterId, comicChapters.id))
      .where(and(eq(comicChapters.comicId, comicId), eq(comicChapterFiles.isManual, true)))
      .all()
  }

  /** Probe results already stored for this entry's files, keyed by path. */
  private readStoredProbes(comicId: string): Map<string, ProbedUnitValues> {
    const files = this.dbService.client
      .select({
        path: comicChapterFiles.path,
        fileSize: comicChapterFiles.fileSize,
        fileMtime: comicChapterFiles.fileMtime,
        container: comicChapterFiles.container,
        pageCount: comicChapterFiles.pageCount
      })
      .from(comicChapterFiles)
      .innerJoin(comicChapters, eq(comicChapterFiles.chapterId, comicChapters.id))
      .where(eq(comicChapters.comicId, comicId))
      .all()

    return new Map(files.map(({ path: filePath, ...values }) => [filePath, values]))
  }

  /**
   * Row values for one candidate container, or null when it is unreadable.
   * Listing is skipped when the stored row already describes this exact file.
   */
  private async probeUnit(
    filePath: string,
    storedProbes: Map<string, ProbedUnitValues>
  ): Promise<ProbedUnitValues | null> {
    const stat = await readFileStat(filePath)
    if (!stat) return null

    const stored = storedProbes.get(filePath)
    if (stored && isProbeCurrent(stored, stat)) {
      return stored
    }

    const info = await this.books.probePagedContainer(filePath)
    if (!info) return null

    return {
      fileSize: stat.size,
      fileMtime: new Date(stat.mtimeMs),
      container: info.container,
      pageCount: info.pageCount
    }
  }

  /**
   * Collect unit candidates under the comic directory.
   *
   * Archives are units wherever they sit within the depth cap. A directory
   * whose direct children include images is one unit and is not descended
   * further; the root itself qualifies only when nothing else was found, so a
   * loose-pages comic still reads as a single unnumbered unit.
   */
  private async walk(dirPath: string, signal?: AbortSignal): Promise<ComicUnitCandidate[]> {
    const candidates: ComicUnitCandidate[] = []
    let rootHasImages = false

    const visit = async (current: string, depth: number): Promise<void> => {
      signal?.throwIfAborted()
      if (depth > MAX_COMIC_WALK_DEPTH) return

      const entries = await fs.readdir(current, { withFileTypes: true }).catch((error) => {
        log.warn('Failed to read comic directory:', error)
        return []
      })

      for (const entry of entries) {
        const entryPath = path.join(current, entry.name)

        if (entry.isFile()) {
          if (isComicArchiveFile(entry.name)) {
            candidates.push(recognizeComicUnit(entryPath, 'archive'))
          } else if (depth === 0 && isComicPageFile(entry.name)) {
            rootHasImages = true
          }
          continue
        }

        if (!entry.isDirectory()) continue

        const childEntries = await fs.readdir(entryPath, { withFileTypes: true }).catch(() => [])
        const hasImages = childEntries.some(
          (child) => child.isFile() && isComicPageFile(child.name)
        )
        if (hasImages) {
          candidates.push(recognizeComicUnit(entryPath, 'directory'))
        } else {
          await visit(entryPath, depth + 1)
        }
      }
    }

    await visit(dirPath, 0)

    if (candidates.length === 0 && rootHasImages) {
      // The root directory is named after the entry, not after a unit, so its
      // numbering is stripped: a comic titled "86" holds one unnumbered unit.
      const {
        volumeNumber: _volume,
        chapterNumber: _chapter,
        ...root
      } = recognizeComicUnit(dirPath, 'directory')
      candidates.push(root)
    }

    return candidates
  }

  /**
   * Map each recognized container onto a unit row, creating rows for numbers
   * the scraped list is missing. Unnumbered existing rows are re-matched
   * through the paths of the files they own, so re-syncs stay idempotent.
   */
  private writeUnits(
    tx: DbContext,
    comicId: string,
    probed: ProbedUnitFile[],
    existingUnits: ComicChapter[],
    existingFiles: ComicChapterFile[]
  ): Map<string, string> {
    const unitById = new Map(existingUnits.map((unit) => [unit.id, unit]))
    const existingByKey = new Map<string, ComicChapter>()
    for (const unit of existingUnits) {
      const key = rowNumberKey(unit)
      if (key) existingByKey.set(key, unit)
    }
    // Unnumbered rows exist only because of their files, so any of their file
    // paths identifies them across runs.
    for (const file of existingFiles) {
      const unit = unitById.get(file.chapterId)
      if (unit && rowNumberKey(unit) === null) {
        existingByKey.set(`file:${file.path}`, unit)
      }
    }

    const unitIdByKey = new Map<string, string>()
    const claimedUnitIds = new Set<string>()
    let nextOrder = existingUnits.length

    for (const { candidate } of probed) {
      const key = unitCandidateKey(candidate)

      if (unitIdByKey.has(key)) continue

      // Exact identity first, then the same volume-knowledge pass ingest uses:
      // renaming `Ch.5.cbz` to `Vol.1 Ch.5.cbz` must move the unit, not fork it.
      const match =
        existingByKey.get(key) ??
        claimUnitAcrossVolumeKnowledge(candidate, existingUnits, claimedUnitIds)
      if (match) {
        claimedUnitIds.add(match.id)
        unitIdByKey.set(key, match.id)
        // A learned volume number is a fact about the same unit; record it so
        // the row's identity matches its files from now on.
        if ((match.volumeNumber ?? null) !== (candidate.volumeNumber ?? null)) {
          tx.update(comicChapters)
            .set({ volumeNumber: candidate.volumeNumber ?? null })
            .where(eq(comicChapters.id, match.id))
            .run()
        }
        continue
      }

      const row: NewComicChapter = {
        id: nanoid(),
        comicId,
        volumeNumber: candidate.volumeNumber ?? null,
        chapterNumber: candidate.chapterNumber ?? null,
        name: isNumberedComicUnit(candidate) ? null : candidate.name,
        orderInComic: nextOrder++
      }

      tx.insert(comicChapters).values(row).run()
      claimedUnitIds.add(row.id as string)
      unitIdByKey.set(key, row.id as string)
    }

    return unitIdByKey
  }

  private writeUnitFiles(
    tx: DbContext,
    probed: ProbedUnitFile[],
    unitIdByKey: Map<string, string>,
    existingFiles: ComicChapterFile[]
  ): number {
    const knownIdByPath = new Map(existingFiles.map((file) => [file.path, file.id]))
    const primaries = readPrimaryElection(existingFiles, (file) => file.chapterId)

    const probedByUnitId = new Map<string, ProbedUnitFile[]>()
    for (const item of probed) {
      const unitId = unitIdByKey.get(unitCandidateKey(item.candidate))
      if (!unitId) continue
      const group = probedByUnitId.get(unitId) ?? []
      group.push(item)
      probedByUnitId.set(unitId, group)
    }

    let count = 0

    // Sync-owned files that vanished from disk must not stay readable. Manual
    // rows are user-owned and may live outside the walked directory, so they
    // stay. Deletion runs first so the partial primary index never sees two
    // rows.
    const livePaths = new Set(probed.map(({ candidate }) => candidate.path))
    for (const file of existingFiles) {
      if (file.isManual || livePaths.has(file.path)) continue
      tx.delete(comicChapterFiles).where(eq(comicChapterFiles.id, file.id)).run()
    }

    for (const [unitId, group] of probedByUnitId) {
      const primaryPath = primaries.elect(
        unitId,
        group.map(({ candidate }) => candidate.path)
      )

      for (const { candidate, values: probedValues } of group) {
        const values = {
          chapterId: unitId,
          path: candidate.path,
          ...probedValues,
          isPrimary: candidate.path === primaryPath
        } satisfies Omit<NewComicChapterFile, 'id'>

        const knownId = knownIdByPath.get(candidate.path)
        if (knownId) {
          tx.update(comicChapterFiles).set(values).where(eq(comicChapterFiles.id, knownId)).run()
        } else {
          tx.insert(comicChapterFiles)
            .values({ id: nanoid(), ...values })
            .run()
        }

        count++
      }
    }

    return count
  }

  /**
   * Unnumbered rows only existed because a file proved them. Once the last
   * file is gone they carry nothing, unless the user read them, attached a
   * manual file, or a session still points at them.
   */
  private deleteOrphanedFileBornUnits(
    tx: DbContext,
    existingUnits: ComicChapter[],
    existingFiles: ComicChapterFile[],
    probed: ProbedUnitFile[],
    unitIdByKey: Map<string, string>
  ): void {
    const retainedIds = new Set<string>()
    for (const { candidate } of probed) {
      const unitId = unitIdByKey.get(unitCandidateKey(candidate))
      if (unitId) retainedIds.add(unitId)
    }
    for (const file of existingFiles) {
      if (file.isManual) retainedIds.add(file.chapterId)
    }

    const candidates = existingUnits.filter(
      (unit) => rowNumberKey(unit) === null && !unit.read && !retainedIds.has(unit.id)
    )
    if (candidates.length === 0) return

    const referencedIds = new Set(
      (tx as DbQueryContext)
        .select({ chapterId: comicSessions.chapterId })
        .from(comicSessions)
        .where(
          inArray(
            comicSessions.chapterId,
            candidates.map((unit) => unit.id)
          )
        )
        .all()
        .flatMap((row) => (row.chapterId ? [row.chapterId] : []))
    )

    for (const unit of candidates) {
      if (referencedIds.has(unit.id)) continue
      tx.delete(comicChapters).where(eq(comicChapters.id, unit.id)).run()
    }
  }
}
