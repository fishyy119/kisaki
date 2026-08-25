/**
 * Novel local file sync and manual file attachment.
 *
 * Sync reconciles the book files under a novel's library directory with its
 * volume and volume-file rows. Metadata scraped from a provider owns volume
 * identity and naming; this pass only attaches readable files to it and
 * creates rows for volumes the provider did not list.
 *
 * File rows have an owner: sync owns only the rows it created and the user
 * never touched. Rows marked `isManual` may point anywhere on disk and are
 * never retargeted, deleted, or stripped of their primary mark by a sync pass.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { createLogger } from '@main/log'
import type { DbContext, DbQueryContext, DbService } from '@main/services/db'
import type { MediaInfoService } from '@main/services/media-info'
import {
  novelSessions,
  novelVolumeFiles,
  novelVolumes,
  novels,
  type NewNovelVolume,
  type NewNovelVolumeFile,
  type NovelVolume,
  type NovelVolumeFile
} from '@shared/db'
import type {
  NovelFileSyncParams,
  NovelFileSyncResult,
  NovelVolumeFileAttachParams
} from '@shared/media-files'
import { isNumberedNovelVolume, novelUnitIdentityKey } from '@shared/metadata'
import { and, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { isNovelBookFile, recognizeNovelVolume, type NovelVolumeCandidate } from './recognition'

const log = createLogger('MediaFiles')

/** Depth cap that covers `Novel/Volumes/…` layouts without deep walking. */
export const MAX_NOVEL_WALK_DEPTH = 2

export interface NovelFileSyncOptions extends NovelFileSyncParams {
  signal?: AbortSignal
}

interface FileStat {
  size: number
  mtimeMs: number
}

interface StattedVolumeFile {
  candidate: NovelVolumeCandidate
  stat: FileStat
  container: string | null
}

/** Sort key that keeps numbered volumes ascending and unnumbered ones last. */
function compareVolumes(a: NovelVolumeCandidate, b: NovelVolumeCandidate): number {
  const aNumber = a.volumeNumber ?? Number.MAX_SAFE_INTEGER
  const bNumber = b.volumeNumber ?? Number.MAX_SAFE_INTEGER
  if (aNumber !== bNumber) return aNumber - bNumber
  return a.fileName.localeCompare(b.fileName)
}

/**
 * Identity of a candidate across sync runs.
 *
 * Numbered files share their volume through the library-wide identity key;
 * unreadable filenames stay one volume per file, keyed by path, since two
 * unreadable names are not evidence of one volume.
 */
function volumeCandidateKey(candidate: NovelVolumeCandidate): string {
  return isNumberedNovelVolume(candidate)
    ? novelUnitIdentityKey(candidate)
    : `file:${candidate.path}`
}

export class NovelFileSyncHandler {
  /**
   * One pass per entry at a time; overlapping passes would each see a
   * pre-write state and duplicate rows. Different entries run in parallel.
   */
  private readonly passes = new Map<string, Promise<NovelFileSyncResult>>()

  constructor(
    private readonly dbService: DbService,
    private readonly mediaInfo: MediaInfoService
  ) {}

  async sync(params: NovelFileSyncOptions): Promise<NovelFileSyncResult> {
    const previous = this.passes.get(params.novelId)
    const pass = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(() =>
      this.runSync(params)
    )

    this.passes.set(params.novelId, pass)
    try {
      return await pass
    } finally {
      if (this.passes.get(params.novelId) === pass) {
        this.passes.delete(params.novelId)
      }
    }
  }

  private async runSync(params: NovelFileSyncOptions): Promise<NovelFileSyncResult> {
    const { novelId, signal } = params
    const dirPath = params.dirPath ?? this.readNovelDirPath(novelId)

    if (!dirPath) {
      throw new Error('Novel has no library directory to scan')
    }

    const candidates = await this.walk(dirPath, signal)

    // Manual rows already claim their paths, so those files leave the
    // candidate set entirely.
    const manualPaths = new Set(this.readManualFiles(novelId).map((file) => file.path))
    const walkable = candidates.filter((candidate) => !manualPaths.has(candidate.path))
    walkable.sort(compareVolumes)

    const statted: StattedVolumeFile[] = []
    for (const candidate of walkable) {
      signal?.throwIfAborted()
      const stat = await this.readStat(candidate.path)
      if (!stat) continue
      statted.push({
        candidate,
        stat,
        container: this.mediaInfo.book.resolveDocumentContainer(candidate.path)
      })
    }

    return this.dbService.client.transaction((tx) => {
      const existingVolumes = tx
        .select()
        .from(novelVolumes)
        .where(eq(novelVolumes.novelId, novelId))
        .all()
      const volumeIds = existingVolumes.map((volume) => volume.id)
      const existingFiles = volumeIds.length
        ? tx
            .select()
            .from(novelVolumeFiles)
            .where(inArray(novelVolumeFiles.volumeId, volumeIds))
            .all()
        : []

      const volumeIdByKey = this.writeVolumes(tx, novelId, statted, existingVolumes, existingFiles)
      const fileCount = this.writeVolumeFiles(tx, statted, volumeIdByKey, existingFiles)
      this.deleteOrphanedFileBornVolumes(tx, existingVolumes, existingFiles, statted, volumeIdByKey)

      return {
        volumeCount: volumeIdByKey.size,
        fileCount,
        unrecognizedFiles: statted
          .filter(({ candidate }) => candidate.volumeNumber === undefined)
          .map(({ candidate }) => candidate.path)
      }
    })
  }

  /** Attach one book file to a volume as a user-owned row. */
  async attachFile(params: NovelVolumeFileAttachParams): Promise<void> {
    const { volumeId, path: filePath } = params

    const stat = await this.readStat(filePath)
    if (!stat) {
      throw new Error(`Novel volume file is not readable: ${filePath}`)
    }
    const container = this.mediaInfo.book.resolveDocumentContainer(filePath)
    if (!container) {
      throw new Error(`Novel volume file is not a supported book container: ${filePath}`)
    }

    this.dbService.client.transaction((tx) => {
      const [volume] = tx
        .select()
        .from(novelVolumes)
        .where(eq(novelVolumes.id, volumeId))
        .limit(1)
        .all()
      if (!volume) {
        throw new Error(`Novel volume not found: ${volumeId}`)
      }

      this.requirePathUnclaimed(tx, filePath)

      const siblings = tx
        .select({ id: novelVolumeFiles.id })
        .from(novelVolumeFiles)
        .where(eq(novelVolumeFiles.volumeId, volumeId))
        .all()

      tx.insert(novelVolumeFiles)
        .values({
          id: nanoid(),
          volumeId,
          path: filePath,
          fileSize: stat.size,
          fileMtime: new Date(stat.mtimeMs),
          container,
          isPrimary: siblings.length === 0,
          isManual: true
        })
        .run()
    })
  }

  /** Throws when the path is already claimed by any volume file row. */
  private requirePathUnclaimed(tx: DbContext, filePath: string): void {
    const [claimed] = (tx as DbQueryContext)
      .select({ id: novelVolumeFiles.id })
      .from(novelVolumeFiles)
      .where(eq(novelVolumeFiles.path, filePath))
      .limit(1)
      .all()
    if (claimed) {
      throw new Error(`File is already attached to a novel volume: ${filePath}`)
    }
  }

  private readNovelDirPath(novelId: string): string | null {
    const [row] = this.dbService.client
      .select({ novelDirPath: novels.novelDirPath })
      .from(novels)
      .where(eq(novels.id, novelId))
      .limit(1)
      .all()

    return row?.novelDirPath ?? null
  }

  private readManualFiles(novelId: string): Array<{ path: string }> {
    return this.dbService.client
      .select({ path: novelVolumeFiles.path })
      .from(novelVolumeFiles)
      .innerJoin(novelVolumes, eq(novelVolumeFiles.volumeId, novelVolumes.id))
      .where(and(eq(novelVolumes.novelId, novelId), eq(novelVolumeFiles.isManual, true)))
      .all()
  }

  private async readStat(filePath: string): Promise<FileStat | null> {
    try {
      const stat = await fs.stat(filePath)
      // Truncated to whole milliseconds, the precision the row stores.
      return { size: stat.size, mtimeMs: Math.trunc(stat.mtimeMs) }
    } catch (error) {
      log.warn('Failed to stat novel file:', error)
      return null
    }
  }

  private async walk(dirPath: string, signal?: AbortSignal): Promise<NovelVolumeCandidate[]> {
    const candidates: NovelVolumeCandidate[] = []

    const visit = async (current: string, depth: number): Promise<void> => {
      signal?.throwIfAborted()
      if (depth > MAX_NOVEL_WALK_DEPTH) return

      const entries = await fs.readdir(current, { withFileTypes: true }).catch((error) => {
        log.warn('Failed to read novel directory:', error)
        return []
      })

      for (const entry of entries) {
        const entryPath = path.join(current, entry.name)

        if (entry.isDirectory()) {
          await visit(entryPath, depth + 1)
          continue
        }

        if (!entry.isFile() || !isNovelBookFile(entry.name)) continue
        candidates.push(recognizeNovelVolume(entryPath))
      }
    }

    await visit(dirPath, 0)
    return candidates
  }

  /**
   * Map each recognized file onto a volume row, creating rows for numbers the
   * scraped list is missing. Unnumbered existing rows are re-matched through
   * the paths of the files they own, so re-syncs stay idempotent.
   */
  private writeVolumes(
    tx: DbContext,
    novelId: string,
    statted: StattedVolumeFile[],
    existingVolumes: NovelVolume[],
    existingFiles: NovelVolumeFile[]
  ): Map<string, string> {
    const volumeById = new Map(existingVolumes.map((volume) => [volume.id, volume]))
    const existingByKey = new Map<string, NovelVolume>()
    for (const volume of existingVolumes) {
      if (volume.volumeNumber !== null) {
        existingByKey.set(`volume:${volume.volumeNumber}`, volume)
      }
    }
    // Unnumbered rows exist only because of their files, so any of their file
    // paths identifies them across runs.
    for (const file of existingFiles) {
      const volume = volumeById.get(file.volumeId)
      if (volume && volume.volumeNumber === null) {
        existingByKey.set(`file:${file.path}`, volume)
      }
    }

    const volumeIdByKey = new Map<string, string>()
    let nextOrder = existingVolumes.length

    for (const { candidate } of statted) {
      const key = volumeCandidateKey(candidate)

      if (volumeIdByKey.has(key)) continue

      const match = existingByKey.get(key)
      if (match) {
        volumeIdByKey.set(key, match.id)
        continue
      }

      const row: NewNovelVolume = {
        id: nanoid(),
        novelId,
        volumeNumber: candidate.volumeNumber ?? null,
        name: candidate.volumeNumber === undefined ? candidate.name : null,
        orderInNovel: nextOrder++
      }

      tx.insert(novelVolumes).values(row).run()
      volumeIdByKey.set(key, row.id as string)
    }

    return volumeIdByKey
  }

  private writeVolumeFiles(
    tx: DbContext,
    statted: StattedVolumeFile[],
    volumeIdByKey: Map<string, string>,
    existingFiles: NovelVolumeFile[]
  ): number {
    const knownIdByPath = new Map(existingFiles.map((file) => [file.path, file.id]))
    const primaryPathsByVolumeId = new Map<string, Set<string>>()
    for (const file of existingFiles) {
      if (!file.isPrimary) continue
      const paths = primaryPathsByVolumeId.get(file.volumeId) ?? new Set<string>()
      paths.add(file.path)
      primaryPathsByVolumeId.set(file.volumeId, paths)
    }
    // A user-pinned manual primary keeps the slot; sync rows then never claim it.
    const manualPrimaryVolumeIds = new Set(
      existingFiles.filter((file) => file.isManual && file.isPrimary).map((file) => file.volumeId)
    )

    const stattedByVolumeId = new Map<string, StattedVolumeFile[]>()
    for (const item of statted) {
      const volumeId = volumeIdByKey.get(volumeCandidateKey(item.candidate))
      if (!volumeId) continue
      const group = stattedByVolumeId.get(volumeId) ?? []
      group.push(item)
      stattedByVolumeId.set(volumeId, group)
    }

    let count = 0

    // Sync-owned files that vanished from disk must not stay readable. Manual
    // rows are user-owned and may live outside the walked directory, so they
    // stay. Deletion runs first so the partial primary index never sees two
    // rows.
    const livePaths = new Set(statted.map(({ candidate }) => candidate.path))
    for (const file of existingFiles) {
      if (file.isManual || livePaths.has(file.path)) continue
      tx.delete(novelVolumeFiles).where(eq(novelVolumeFiles.id, file.id)).run()
    }

    for (const [volumeId, group] of stattedByVolumeId) {
      // A stored primary preference survives as long as its file does; a new
      // primary is elected only when no preferred file remains on disk and no
      // manual row already holds the slot.
      const preferredPaths = primaryPathsByVolumeId.get(volumeId)
      const primaryPath = manualPrimaryVolumeIds.has(volumeId)
        ? null
        : (group.find(({ candidate }) => preferredPaths?.has(candidate.path))?.candidate.path ??
          group[0].candidate.path)

      for (const { candidate, stat, container } of group) {
        const values = {
          volumeId,
          path: candidate.path,
          fileSize: stat.size,
          fileMtime: new Date(stat.mtimeMs),
          container,
          isPrimary: candidate.path === primaryPath
        } satisfies Omit<NewNovelVolumeFile, 'id'>

        const knownId = knownIdByPath.get(candidate.path)
        if (knownId) {
          tx.update(novelVolumeFiles).set(values).where(eq(novelVolumeFiles.id, knownId)).run()
        } else {
          tx.insert(novelVolumeFiles)
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
  private deleteOrphanedFileBornVolumes(
    tx: DbContext,
    existingVolumes: NovelVolume[],
    existingFiles: NovelVolumeFile[],
    statted: StattedVolumeFile[],
    volumeIdByKey: Map<string, string>
  ): void {
    const retainedIds = new Set<string>()
    for (const { candidate } of statted) {
      const volumeId = volumeIdByKey.get(volumeCandidateKey(candidate))
      if (volumeId) retainedIds.add(volumeId)
    }
    for (const file of existingFiles) {
      if (file.isManual) retainedIds.add(file.volumeId)
    }

    const candidates = existingVolumes.filter(
      (volume) => volume.volumeNumber === null && !volume.read && !retainedIds.has(volume.id)
    )
    if (candidates.length === 0) return

    const referencedIds = new Set(
      (tx as DbQueryContext)
        .select({ volumeId: novelSessions.volumeId })
        .from(novelSessions)
        .where(
          inArray(
            novelSessions.volumeId,
            candidates.map((volume) => volume.id)
          )
        )
        .all()
        .flatMap((row) => (row.volumeId ? [row.volumeId] : []))
    )

    for (const volume of candidates) {
      if (referencedIds.has(volume.id)) continue
      tx.delete(novelVolumes).where(eq(novelVolumes.id, volume.id)).run()
    }
  }
}
