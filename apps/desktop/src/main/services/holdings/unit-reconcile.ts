/**
 * Unit-file reconciliation engine.
 *
 * One algorithm reconciles recognized on-disk candidates with an entry's unit
 * and unit-file rows: match candidates to rows by identity key, re-locate
 * unnumbered rows through their files, create missing rows, write file rows
 * with primary election, delete sync-owned files that vanished, and delete
 * file-born units that lost every file — never touching user-owned state.
 *
 * Everything per-media is a schema fact or an injected function in the spec:
 * comic chapters, novel volumes, and anime episodes instantiate it. Anime
 * extras stay a per-media pass — they reconcile by file ownership without
 * unit identity, a structural difference rather than a parameter.
 */

import type { DbContext } from '@main/services/db'
import { readPrimaryElection } from './sync-pass'

export interface ReconcilableUnit {
  id: string
}

export interface ReconcilableUnitFile {
  id: string
  path: string
  isPrimary: boolean
  isManual: boolean
}

export interface ProbedUnitCandidate<TCandidate, TValues> {
  candidate: TCandidate
  values: TValues
}

export interface UnitReconcileSpec<
  TUnit extends ReconcilableUnit,
  TFile extends ReconcilableUnitFile,
  TCandidate,
  TValues
> {
  /**
   * Identity of a candidate across runs, and across sibling versions of one
   * unit within a run. Unnumbered candidates key by group or by file path.
   */
  candidateKey(candidate: TCandidate): string
  /** Identity key of a stored row; null keys the row by the files it owns. */
  rowKey(unit: TUnit): string | null
  /** Key an unnumbered row is re-located by through one of its file paths. */
  fileGroupKey(filePath: string, unit: TUnit): string
  /**
   * Last-resort claim beyond exact identity, over rows no candidate claimed
   * yet. Comic contributes its cross-volume-knowledge pass here.
   */
  claimFallback?(
    candidate: TCandidate,
    units: readonly TUnit[],
    claimedIds: ReadonlySet<string>
  ): TUnit | undefined
  /**
   * Fold candidate facts into a matched row: comic learns volume numbers,
   * anime backfills episode durations.
   */
  onMatched?(tx: DbContext, unit: TUnit, candidate: TCandidate, values: TValues): void
  /** Insert the unit row a candidate proves; returns the new row id. */
  insertUnit(
    tx: DbContext,
    ownerId: string,
    candidate: TCandidate,
    values: TValues,
    order: number
  ): string
  deleteUnit(tx: DbContext, unitId: string): void
  /** Owning unit id of a stored file row. */
  fileUnitId(file: TFile): string
  insertFile(
    tx: DbContext,
    unitId: string,
    candidate: TCandidate,
    values: TValues,
    isPrimary: boolean
  ): void
  updateFile(
    tx: DbContext,
    fileId: string,
    unitId: string,
    candidate: TCandidate,
    values: TValues,
    isPrimary: boolean
  ): void
  deleteFile(tx: DbContext, fileId: string): void
  /** User activity that protects a file-born unit from orphan deletion. */
  isUnitProtected(unit: TUnit): boolean
  /** Unit ids still referenced by sessions, among the given candidates. */
  readSessionReferencedUnitIds(tx: DbContext, unitIds: readonly string[]): ReadonlySet<string>
  candidatePath(candidate: TCandidate): string
}

export interface UnitReconcileResult {
  /** Distinct units the candidates resolved to. */
  unitIdByKey: Map<string, string>
  /** File rows written (inserted or refreshed) this pass. */
  fileCount: number
}

/**
 * Reconcile probed candidates against the entry's current rows, inside the
 * caller's transaction. The caller loads current state and owns result
 * projection; this function owns every write.
 */
export function reconcileUnitFiles<
  TUnit extends ReconcilableUnit,
  TFile extends ReconcilableUnitFile,
  TCandidate,
  TValues
>(
  tx: DbContext,
  spec: UnitReconcileSpec<TUnit, TFile, TCandidate, TValues>,
  args: {
    ownerId: string
    probed: ReadonlyArray<ProbedUnitCandidate<TCandidate, TValues>>
    existingUnits: readonly TUnit[]
    existingFiles: readonly TFile[]
  }
): UnitReconcileResult {
  const { ownerId, probed, existingUnits, existingFiles } = args

  const unitIdByKey = writeUnits(tx, spec, ownerId, probed, existingUnits, existingFiles)
  const fileCount = writeUnitFiles(tx, spec, probed, unitIdByKey, existingFiles)
  deleteOrphanedFileBornUnits(tx, spec, existingUnits, existingFiles, probed, unitIdByKey)

  return { unitIdByKey, fileCount }
}

/**
 * Map each candidate onto a unit row, creating rows the scraped list is
 * missing. Unnumbered existing rows are re-matched by their group key, then
 * by the paths of the files they own, so a re-sync stays idempotent even
 * after the row was renamed by hand.
 */
function writeUnits<
  TUnit extends ReconcilableUnit,
  TFile extends ReconcilableUnitFile,
  TCandidate,
  TValues
>(
  tx: DbContext,
  spec: UnitReconcileSpec<TUnit, TFile, TCandidate, TValues>,
  ownerId: string,
  probed: ReadonlyArray<ProbedUnitCandidate<TCandidate, TValues>>,
  existingUnits: readonly TUnit[],
  existingFiles: readonly TFile[]
): Map<string, string> {
  const unitById = new Map(existingUnits.map((unit) => [unit.id, unit]))
  const existingByKey = new Map<string, TUnit>()
  for (const unit of existingUnits) {
    const key = spec.rowKey(unit)
    if (key !== null) existingByKey.set(key, unit)
  }
  // Unnumbered rows exist only because of their files, so those files locate
  // them again: their group key when the stored identity still matches, and
  // the path outright when a rename moved it out of reach.
  const existingByFilePath = new Map<string, TUnit>()
  for (const file of existingFiles) {
    const unit = unitById.get(spec.fileUnitId(file))
    if (!unit || spec.rowKey(unit) !== null) continue

    existingByFilePath.set(file.path, unit)
    const groupKey = spec.fileGroupKey(file.path, unit)
    if (!existingByKey.has(groupKey)) existingByKey.set(groupKey, unit)
  }

  const unitIdByKey = new Map<string, string>()
  const claimedUnitIds = new Set<string>()
  let nextOrder = existingUnits.length

  for (const { candidate, values } of probed) {
    const key = spec.candidateKey(candidate)

    if (unitIdByKey.has(key)) continue

    const match =
      existingByKey.get(key) ??
      existingByFilePath.get(spec.candidatePath(candidate)) ??
      spec.claimFallback?.(candidate, existingUnits, claimedUnitIds)
    if (match) {
      claimedUnitIds.add(match.id)
      unitIdByKey.set(key, match.id)
      spec.onMatched?.(tx, match, candidate, values)
      continue
    }

    const newUnitId = spec.insertUnit(tx, ownerId, candidate, values, nextOrder++)
    claimedUnitIds.add(newUnitId)
    unitIdByKey.set(key, newUnitId)
  }

  return unitIdByKey
}

function writeUnitFiles<
  TUnit extends ReconcilableUnit,
  TFile extends ReconcilableUnitFile,
  TCandidate,
  TValues
>(
  tx: DbContext,
  spec: UnitReconcileSpec<TUnit, TFile, TCandidate, TValues>,
  probed: ReadonlyArray<ProbedUnitCandidate<TCandidate, TValues>>,
  unitIdByKey: Map<string, string>,
  existingFiles: readonly TFile[]
): number {
  const knownIdByPath = new Map(existingFiles.map((file) => [file.path, file.id]))
  const primaries = readPrimaryElection(existingFiles, (file) => spec.fileUnitId(file))

  const probedByUnitId = new Map<string, ProbedUnitCandidate<TCandidate, TValues>[]>()
  for (const item of probed) {
    const unitId = unitIdByKey.get(spec.candidateKey(item.candidate))
    if (!unitId) continue
    const group = probedByUnitId.get(unitId) ?? []
    group.push(item)
    probedByUnitId.set(unitId, group)
  }

  let count = 0

  // Sync-owned files that vanished from disk must not stay playable. Manual
  // rows are user-owned and may live outside the walked directory, so they
  // stay. Deletion runs first so the partial primary index never sees two
  // rows.
  const livePaths = new Set(probed.map(({ candidate }) => spec.candidatePath(candidate)))
  for (const file of existingFiles) {
    if (file.isManual || livePaths.has(file.path)) continue
    spec.deleteFile(tx, file.id)
  }

  for (const [unitId, group] of probedByUnitId) {
    const primaryPath = primaries.elect(
      unitId,
      group.map(({ candidate }) => spec.candidatePath(candidate))
    )

    for (const { candidate, values } of group) {
      const isPrimary = spec.candidatePath(candidate) === primaryPath
      const knownId = knownIdByPath.get(spec.candidatePath(candidate))
      if (knownId) {
        spec.updateFile(tx, knownId, unitId, candidate, values, isPrimary)
      } else {
        spec.insertFile(tx, unitId, candidate, values, isPrimary)
      }

      count++
    }
  }

  return count
}

/**
 * Unnumbered rows only existed because a file proved them. Once the last
 * file is gone they carry nothing, unless the user consumed them, attached a
 * manual file, or a session still points at them.
 */
function deleteOrphanedFileBornUnits<
  TUnit extends ReconcilableUnit,
  TFile extends ReconcilableUnitFile,
  TCandidate,
  TValues
>(
  tx: DbContext,
  spec: UnitReconcileSpec<TUnit, TFile, TCandidate, TValues>,
  existingUnits: readonly TUnit[],
  existingFiles: readonly TFile[],
  probed: ReadonlyArray<ProbedUnitCandidate<TCandidate, TValues>>,
  unitIdByKey: Map<string, string>
): void {
  const retainedIds = new Set<string>()
  for (const { candidate } of probed) {
    const unitId = unitIdByKey.get(spec.candidateKey(candidate))
    if (unitId) retainedIds.add(unitId)
  }
  for (const file of existingFiles) {
    if (file.isManual) retainedIds.add(spec.fileUnitId(file))
  }

  const candidates = existingUnits.filter(
    (unit) => spec.rowKey(unit) === null && !spec.isUnitProtected(unit) && !retainedIds.has(unit.id)
  )
  if (candidates.length === 0) return

  const referencedIds = spec.readSessionReferencedUnitIds(
    tx,
    candidates.map((unit) => unit.id)
  )

  for (const unit of candidates) {
    if (referencedIds.has(unit.id)) continue
    spec.deleteUnit(tx, unit.id)
  }
}
