import { eq, inArray } from 'drizzle-orm'
import { novelExternalIdLink, requireExternalIdsAvailable, type DbContext } from '@main/services/db'
import {
  IngestPersistHandlers,
  insertNovelVolumeExternalIds,
  insertNovelVolumeRow
} from '../../persist'
import type { PendingAssetTask } from '../../assets'
import {
  novelExternalIds,
  novelSessions,
  novelTagLinks,
  novelVolumeExternalIds,
  novelVolumeFiles,
  novelVolumes,
  novels,
  type NewNovel,
  type NovelVolume
} from '@shared/db'
import { normalizeExternalIds, toExternalIdKey } from '@shared/identity'
import type { NovelVolumeInfo } from '@shared/metadata'
import type {
  NovelLinkKind,
  NovelUpdatePlan,
  NovelVolumeUpdatePlan,
  UpdateLinkApplyResult
} from '../types'
import { areScalarValuesEqual } from '../shared/merge'
import { applyMediaRelationFacts } from '../../media-relations'
import {
  applyMediaLinkGraph,
  replaceEntityExternalIds,
  replaceEntityTags,
  type ExternalIdRowSpec,
  type TagLinkRowSpec
} from './links'

const NOVEL_EXTERNAL_ID_SPEC: ExternalIdRowSpec = {
  table: novelExternalIds,
  entityIdColumn: novelExternalIds.novelId,
  entityIdField: 'novelId',
  orderField: 'orderInNovel'
}

const NOVEL_TAG_LINK_SPEC: TagLinkRowSpec = {
  table: novelTagLinks,
  entityIdColumn: novelTagLinks.novelId,
  entityIdField: 'novelId',
  orderInEntityField: 'orderInNovel'
}

interface VolumeMatch {
  row: NovelVolume
  volume: NovelVolumeInfo
  /** Position in the authoritative incoming list, written to `orderInNovel`. */
  order: number
}

/** Scrape-owned metadata refresh; read state and covers are never touched. */
function updateMatchedVolume(tx: DbContext, match: VolumeMatch): void {
  const { row, volume, order } = match
  const patch: Partial<NovelVolume> = {}

  // Realignment is the point: an id-matched row takes the source's current
  // numbering. Fields the source omitted stay as stored, because volume fields
  // carry no known-empty marker.
  const volumeNumber = volume.volumeNumber ?? null
  if (volumeNumber !== row.volumeNumber) patch.volumeNumber = volumeNumber
  if (order !== row.orderInNovel) patch.orderInNovel = order
  if (volume.name !== undefined && volume.name !== (row.name ?? undefined)) {
    patch.name = volume.name
  }
  if (
    volume.originalName !== undefined &&
    volume.originalName !== (row.originalName ?? undefined)
  ) {
    patch.originalName = volume.originalName
  }
  if (
    volume.releaseDate !== undefined &&
    !areScalarValuesEqual(row.releaseDate, volume.releaseDate)
  ) {
    patch.releaseDate = volume.releaseDate
  }
  if (volume.description !== undefined && volume.description !== (row.description ?? undefined)) {
    patch.description = volume.description
  }

  if (Object.keys(patch).length > 0) {
    tx.update(novelVolumes).set(patch).where(eq(novelVolumes.id, row.id)).run()
  }
}

/**
 * Reconcile stored volume rows against the authoritative incoming list.
 *
 * Incoming volumes claim stored rows by shared external id first, then by
 * volume number for rows no id claimed; sources revise numbering, so identity
 * outranks position. Matched rows refresh scraped metadata but never read
 * state (`read`/`readAt`/`readCount`/`resumeLocator`/`resumeProgress`/
 * `coverFile`). Unclaimed incoming volumes insert with their identity. Stored
 * rows the source no longer lists are deleted only under `replace` and only
 * when nothing user-owned hangs off them: not read, no readable files, no
 * sessions. `merge` never deletes.
 */
function reconcileNovelVolumes(tx: DbContext, novelId: string, plan: NovelVolumeUpdatePlan): void {
  const existing = tx.select().from(novelVolumes).where(eq(novelVolumes.novelId, novelId)).all()
  const existingIds = existing.map((row) => row.id)
  const idRows = existingIds.length
    ? tx
        .select()
        .from(novelVolumeExternalIds)
        .where(inArray(novelVolumeExternalIds.volumeId, existingIds))
        .all()
    : []

  const volumeIdByExternalKey = new Map<string, string>()
  const externalKeysByVolumeId = new Map<string, Set<string>>()
  for (const row of idRows) {
    const key = toExternalIdKey({ source: row.source, id: row.externalId })
    if (!volumeIdByExternalKey.has(key)) {
      volumeIdByExternalKey.set(key, row.volumeId)
    }
    const keys = externalKeysByVolumeId.get(row.volumeId) ?? new Set<string>()
    keys.add(key)
    externalKeysByVolumeId.set(row.volumeId, keys)
  }

  const rowById = new Map(existing.map((row) => [row.id, row]))
  const claimedRowIds = new Set<string>()
  const matches: VolumeMatch[] = []
  const numberPass: Array<{ volume: NovelVolumeInfo; order: number }> = []

  for (const [order, volume] of plan.items.entries()) {
    let claimedId: string | undefined
    for (const extId of normalizeExternalIds(volume.externalIds)) {
      const candidate = volumeIdByExternalKey.get(toExternalIdKey(extId))
      if (candidate && !claimedRowIds.has(candidate)) {
        claimedId = candidate
        break
      }
    }

    if (claimedId) {
      claimedRowIds.add(claimedId)
      matches.push({ row: rowById.get(claimedId) as NovelVolume, volume, order })
    } else {
      numberPass.push({ volume, order })
    }
  }

  const rowsByNumber = new Map<number, NovelVolume[]>()
  for (const row of existing) {
    if (claimedRowIds.has(row.id) || row.volumeNumber === null) continue
    const queue = rowsByNumber.get(row.volumeNumber) ?? []
    queue.push(row)
    rowsByNumber.set(row.volumeNumber, queue)
  }

  const inserts: Array<{ volume: NovelVolumeInfo; order: number }> = []
  for (const { volume, order } of numberPass) {
    const row =
      volume.volumeNumber === undefined ? undefined : rowsByNumber.get(volume.volumeNumber)?.shift()
    if (row) {
      claimedRowIds.add(row.id)
      matches.push({ row, volume, order })
    } else {
      inserts.push({ volume, order })
    }
  }

  // Deletions run first so identities freed by removed rows can re-attach to
  // the rows the source now lists (volume ids are globally unique).
  if (plan.mode === 'replace') {
    const leftovers = existing.filter((row) => !claimedRowIds.has(row.id))
    if (leftovers.length > 0) {
      const leftoverIds = leftovers.map((row) => row.id)
      const referencedIds = new Set<string>([
        ...tx
          .select()
          .from(novelVolumeFiles)
          .where(inArray(novelVolumeFiles.volumeId, leftoverIds))
          .all()
          .map((row) => row.volumeId),
        ...tx
          .select()
          .from(novelSessions)
          .where(inArray(novelSessions.volumeId, leftoverIds))
          .all()
          .flatMap((row) => (row.volumeId ? [row.volumeId] : []))
      ])

      for (const row of leftovers) {
        if (row.read || referencedIds.has(row.id)) continue
        tx.delete(novelVolumes).where(eq(novelVolumes.id, row.id)).run()
      }
    }
  }

  for (const match of matches) {
    updateMatchedVolume(tx, match)

    const knownKeys = externalKeysByVolumeId.get(match.row.id) ?? new Set<string>()
    const missingIds = normalizeExternalIds(match.volume.externalIds).filter(
      (extId) => !knownKeys.has(toExternalIdKey(extId))
    )
    if (missingIds.length > 0) {
      insertNovelVolumeExternalIds(tx, match.row.id, missingIds, knownKeys.size)
    }
  }

  for (const { volume, order } of inserts) {
    insertNovelVolumeRow(tx, novelId, volume, order)
  }
}

export function applyNovelPlan(
  tx: DbContext,
  novelId: string,
  plan: NovelUpdatePlan,
  persistHandlers: IngestPersistHandlers
): UpdateLinkApplyResult<NovelLinkKind> {
  if (plan.externalIds) {
    requireExternalIdsAvailable(tx, novelExternalIdLink, [novelId], plan.externalIds)
    replaceEntityExternalIds(tx, NOVEL_EXTERNAL_ID_SPEC, novelId, plan.externalIds)
  }

  if (plan.tags) {
    replaceEntityTags(tx, NOVEL_TAG_LINK_SPEC, novelId, plan.tags)
  }

  if (Object.keys(plan.patch).length > 0) {
    tx.update(novels)
      .set(plan.patch as Partial<NewNovel>)
      .where(eq(novels.id, novelId))
      .run()
  }

  if (plan.volumes) {
    reconcileNovelVolumes(tx, novelId, plan.volumes)
  }

  const plannedMedia: Array<[string, string | undefined]> = [
    ['coverFile', plan.coverUrl],
    ['backdropFile', plan.backdropUrl],
    ['logoFile', plan.logoUrl]
  ]
  const pendingAssets: PendingAssetTask[] = plannedMedia
    .filter(([, url]) => Boolean(url))
    .map(([field, url]) => ({ table: 'novels', rowId: novelId, field, url: url as string }))

  const relationGraph = plan.relationGraph
  const relations = relationGraph
    ? applyMediaLinkGraph({
        tx,
        entityId: novelId,
        persistHandlers,
        nodes: relationGraph,
        person: {
          kind: 'novelPerson',
          mode: plan.links.novelPerson,
          links: relationGraph.links.novelPerson
        },
        company: {
          kind: 'novelCompany',
          mode: plan.links.novelCompany,
          links: relationGraph.links.novelCompany
        },
        character: {
          kind: 'novelCharacter',
          mode: plan.links.novelCharacter,
          links: relationGraph.links.novelCharacter
        },
        characterPerson: {
          mode: plan.links.characterPerson,
          links: relationGraph.links.characterPerson
        }
      })
    : { pendingAssets: [] as PendingAssetTask[], preservedLinkRows: {} }
  pendingAssets.push(...relations.pendingAssets)

  let unresolvedRelatedEntries: number | undefined
  if (plan.relatedEntries) {
    const relatedResult = applyMediaRelationFacts({
      tx,
      mediaType: 'novel',
      entityId: novelId,
      facts: plan.relatedEntries.facts,
      collectionMode: plan.relatedEntries.mode
    })
    if (relatedResult.unresolvedCount > 0) {
      unresolvedRelatedEntries = relatedResult.unresolvedCount
    }
  }

  return {
    pendingAssets,
    preservedLinkRows: relations.preservedLinkRows,
    ...(unresolvedRelatedEntries !== undefined && { unresolvedRelatedEntries })
  }
}
