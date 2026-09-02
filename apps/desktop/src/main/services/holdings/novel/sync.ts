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
import { readFileStat, SyncPassQueue, unnamedUnitGroupKey } from '../sync-pass'
import { reconcileUnitFiles, type UnitReconcileSpec } from '../unit-reconcile'
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
import { resolveDocumentContainer } from '@shared/book'
import type {
  NovelFileSyncParams,
  NovelFileSyncResult,
  NovelVolumeFileAttachParams
} from '@shared/holdings'
import { isNumberedNovelVolume, novelUnitIdentityKey } from '@shared/metadata'
import { and, eq, inArray } from 'drizzle-orm'
import { newId } from '@shared/id'
import { isNovelBookFile, recognizeNovelVolume, type NovelVolumeCandidate } from './recognition'

const log = createLogger('Holdings')

/** Depth cap that covers `Novel/Volumes/…` layouts without deep walking. */
export const MAX_NOVEL_WALK_DEPTH = 2

export interface NovelFileSyncOptions extends NovelFileSyncParams {
  signal?: AbortSignal
}

/** Column values a volume file row carries from one stat pass. */
interface ProbedVolumeValues {
  fileSize: number
  fileMtime: Date
  container: string | null
}

interface ProbedVolumeFile {
  candidate: NovelVolumeCandidate
  values: ProbedVolumeValues
}

/** Sort key that keeps numbered volumes ascending and unnumbered ones last. */
function compareVolumes(a: NovelVolumeCandidate, b: NovelVolumeCandidate): number {
  const aNumber = a.volumeNumber ?? Number.MAX_SAFE_INTEGER
  const bNumber = b.volumeNumber ?? Number.MAX_SAFE_INTEGER
  if (aNumber !== bNumber) return aNumber - bNumber
  return a.fileName.localeCompare(b.fileName)
}

/**
 * Identity of a candidate across sync runs, and across sibling versions of one
 * volume within a run.
 *
 * Numbered files share their volume through the library-wide identity key;
 * unnumbered ones group by directory and cleaned name, so an EPUB and its TXT
 * source become two files of one volume.
 */
function volumeCandidateKey(candidate: NovelVolumeCandidate): string {
  return isNumberedNovelVolume(candidate)
    ? novelUnitIdentityKey(candidate)
    : unnamedUnitGroupKey(candidate.path, candidate.name)
}

/** Identity key of a stored row; null keys the row by the files it owns. */
function volumeRowKey(volume: NovelVolume): string | null {
  return isNumberedNovelVolume(volume) ? novelUnitIdentityKey(volume) : null
}

const NOVEL_UNIT_RECONCILE_SPEC: UnitReconcileSpec<
  NovelVolume,
  NovelVolumeFile,
  NovelVolumeCandidate,
  ProbedVolumeValues
> = {
  candidateKey: volumeCandidateKey,
  candidatePath: (candidate) => candidate.path,
  rowKey: volumeRowKey,
  fileGroupKey: (filePath, volume) => unnamedUnitGroupKey(filePath, volume.name ?? ''),
  insertUnit: (tx, novelId, candidate, _values, order) => {
    const id = newId()
    const row: NewNovelVolume = {
      id,
      novelId,
      volumeNumber: candidate.volumeNumber ?? null,
      name: candidate.volumeNumber === undefined ? candidate.name : null,
      orderInNovel: order
    }
    tx.insert(novelVolumes).values(row).run()
    return id
  },
  deleteUnit: (tx, unitId) => {
    tx.delete(novelVolumes).where(eq(novelVolumes.id, unitId)).run()
  },
  fileUnitId: (file) => file.volumeId,
  insertFile: (tx, unitId, candidate, values, isPrimary) => {
    const fileValues = {
      volumeId: unitId,
      path: candidate.path,
      ...values,
      isPrimary
    } satisfies Omit<NewNovelVolumeFile, 'id'>
    tx.insert(novelVolumeFiles)
      .values({ id: newId(), ...fileValues })
      .run()
  },
  updateFile: (tx, fileId, unitId, candidate, values, isPrimary) => {
    const fileValues = {
      volumeId: unitId,
      path: candidate.path,
      ...values,
      isPrimary
    } satisfies Omit<NewNovelVolumeFile, 'id'>
    tx.update(novelVolumeFiles).set(fileValues).where(eq(novelVolumeFiles.id, fileId)).run()
  },
  deleteFile: (tx, fileId) => {
    tx.delete(novelVolumeFiles).where(eq(novelVolumeFiles.id, fileId)).run()
  },
  isUnitProtected: (volume) => volume.read,
  readSessionReferencedUnitIds: (tx, unitIds) =>
    new Set(
      (tx as DbQueryContext)
        .select({ volumeId: novelSessions.volumeId })
        .from(novelSessions)
        .where(inArray(novelSessions.volumeId, [...unitIds]))
        .all()
        .flatMap((row) => (row.volumeId ? [row.volumeId] : []))
    )
}

export class NovelFileSyncCoordinator {
  private readonly passes = new SyncPassQueue<NovelFileSyncResult>()

  constructor(private readonly dbService: DbService) {}

  async sync(params: NovelFileSyncOptions): Promise<NovelFileSyncResult> {
    return this.passes.run(params.novelId, () => this.runSync(params))
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

    const probed: ProbedVolumeFile[] = []
    for (const candidate of walkable) {
      signal?.throwIfAborted()
      const stat = await readFileStat(candidate.path)
      if (!stat) continue
      probed.push({
        candidate,
        values: {
          fileSize: stat.size,
          fileMtime: new Date(stat.mtimeMs),
          container: resolveDocumentContainer(candidate.path)
        }
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

      const reconciled = reconcileUnitFiles(tx, NOVEL_UNIT_RECONCILE_SPEC, {
        ownerId: novelId,
        probed,
        existingUnits: existingVolumes,
        existingFiles
      })

      return {
        volumeCount: reconciled.unitIdByKey.size,
        fileCount: reconciled.fileCount,
        unrecognizedFiles: probed
          .filter(({ candidate }) => candidate.volumeNumber === undefined)
          .map(({ candidate }) => candidate.path)
      }
    })
  }

  /** Attach one book file to a volume as a user-owned row. */
  async attachFile(params: NovelVolumeFileAttachParams): Promise<void> {
    const { volumeId, path: filePath } = params

    const stat = await readFileStat(filePath)
    if (!stat) {
      throw new Error(`Novel volume file is not readable: ${filePath}`)
    }
    const container = resolveDocumentContainer(filePath)
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
          id: newId(),
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

  /** Stored path of one volume file row, or null when no row claims that id. */
  findFilePath(fileId: string): string | null {
    const row = this.dbService.client
      .select({ path: novelVolumeFiles.path })
      .from(novelVolumeFiles)
      .where(eq(novelVolumeFiles.id, fileId))
      .get()
    return row?.path ?? null
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
      .select({ dirPath: novels.dirPath })
      .from(novels)
      .where(eq(novels.id, novelId))
      .limit(1)
      .all()

    return row?.dirPath ?? null
  }

  private readManualFiles(novelId: string): Array<{ path: string }> {
    return this.dbService.client
      .select({ path: novelVolumeFiles.path })
      .from(novelVolumeFiles)
      .innerJoin(novelVolumes, eq(novelVolumeFiles.volumeId, novelVolumes.id))
      .where(and(eq(novelVolumes.novelId, novelId), eq(novelVolumeFiles.isManual, true)))
      .all()
  }

  private async walk(dirPath: string, signal?: AbortSignal): Promise<NovelVolumeCandidate[]> {
    const candidates: NovelVolumeCandidate[] = []

    const visit = async (current: string, depth: number): Promise<void> => {
      signal?.throwIfAborted()
      if (depth > MAX_NOVEL_WALK_DEPTH) return

      const entries = await fs.readdir(current, { withFileTypes: true }).catch((error) => {
        log.warn('Failed to read novel directory.', error)
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
}
