/**
 * Mechanics every file sync pass repeats.
 *
 * Only the parts that carry no unit meaning live here: how passes for one
 * entry are serialized, how a file's revision is read and compared against a
 * stored probe, and which file holds the primary mark. What a unit is, how
 * candidates map onto rows, and when a row may be deleted stay in each media
 * type's own sync coordinator, because those differ per type.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createLogger } from '@main/log'

const log = createLogger('Holdings')

/**
 * One pass per entry at a time.
 *
 * A manual sync, a scan finishing, and a watched download can all ask for the
 * same entry at once; overlapping passes would each see a pre-write state and
 * duplicate rows. Passes for different entries still run in parallel.
 */
export class SyncPassQueue<TResult> {
  private readonly passes = new Map<string, Promise<TResult>>()

  async run(entryId: string, pass: () => Promise<TResult>): Promise<TResult> {
    const previous = this.passes.get(entryId)
    const next = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(pass)

    this.passes.set(entryId, next)
    try {
      return await next
    } finally {
      if (this.passes.get(entryId) === next) {
        this.passes.delete(entryId)
      }
    }
  }
}

/**
 * Grouping key for a unit whose file states no number.
 *
 * Sibling versions of one unit are exactly the files that sit together and
 * clean to the same name: an EPUB beside its TXT source, a raw scan beside a
 * cleaned release. Both file layers are built to hold those together, so they
 * share one unit rather than forking one row each.
 *
 * The name must match, not merely resemble: two unreadable names are no
 * evidence of one unit, and only an identical one is. Directory scope keeps
 * same-named installments in sibling folders apart. Casing is folded because
 * it never distinguishes two releases.
 */
export function unnamedUnitGroupKey(filePath: string, cleanedName: string): string {
  return `unnamed:${path.dirname(filePath)}\u0000${cleanedName.trim().toLowerCase()}`
}

/** The revision facts a file row stores, for telling changed files apart. */
export interface FileStat {
  size: number
  mtimeMs: number
}

/** Stat of one file, or null when it cannot be read. */
export async function readFileStat(filePath: string): Promise<FileStat | null> {
  try {
    const stat = await fs.stat(filePath)
    // Truncated to whole milliseconds, the precision the row stores, so a
    // stored value compares equal to the same unchanged file.
    return { size: stat.size, mtimeMs: Math.trunc(stat.mtimeMs) }
  } catch (error) {
    log.warn('Failed to stat library file.', error, { fileName: path.basename(filePath) })
    return null
  }
}

/** The revision columns a probed file row carries. */
export interface ProbedRevision {
  fileSize: number | null
  fileMtime: Date | null
}

/** Whether stored values already describe the file as it is on disk now. */
export function isProbeCurrent(stored: ProbedRevision, stat: FileStat): boolean {
  return stored.fileSize === stat.size && stored.fileMtime?.getTime() === stat.mtimeMs
}

/** The file-row columns primary election reads, whatever unit owns the row. */
export interface OwnedFileRow {
  path: string
  isPrimary: boolean
  isManual: boolean
}

export interface PrimaryElection {
  /** Path that should carry the primary mark, or null when no sync row may. */
  elect(ownerId: string, candidatePaths: readonly string[]): string | null
}

/**
 * Reads the primary marks as they stand, so a pass can keep them.
 *
 * A stored primary preference survives as long as its file does; a new primary
 * is elected only when no preferred file remains on disk. A user-pinned manual
 * primary keeps the slot outright, and sync rows never claim it.
 */
export function readPrimaryElection<TFile extends OwnedFileRow>(
  existingFiles: readonly TFile[],
  ownerIdOf: (file: TFile) => string
): PrimaryElection {
  const preferredPathsByOwnerId = new Map<string, Set<string>>()
  const manualPrimaryOwnerIds = new Set<string>()

  for (const file of existingFiles) {
    if (!file.isPrimary) continue

    const ownerId = ownerIdOf(file)
    const paths = preferredPathsByOwnerId.get(ownerId) ?? new Set<string>()
    paths.add(file.path)
    preferredPathsByOwnerId.set(ownerId, paths)
    if (file.isManual) manualPrimaryOwnerIds.add(ownerId)
  }

  return {
    elect(ownerId, candidatePaths) {
      if (manualPrimaryOwnerIds.has(ownerId)) return null

      const preferred = preferredPathsByOwnerId.get(ownerId)
      return (
        candidatePaths.find((candidate) => preferred?.has(candidate)) ?? candidatePaths[0] ?? null
      )
    }
  }
}
