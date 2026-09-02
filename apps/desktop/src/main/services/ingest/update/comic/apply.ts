import { eq, inArray } from 'drizzle-orm'
import { comicExternalIdLink, requireExternalIdsAvailable, type DbContext } from '@main/services/db'
import {
  IngestPersisters,
  insertComicChapterExternalIds,
  insertComicChapterRow
} from '../../persist'
import type { PendingAssetTask } from '../../assets'
import {
  comicChapterExternalIds,
  comicChapterFiles,
  comicChapters,
  comicExternalIds,
  comicSessions,
  comicTagLinks,
  comics,
  type ComicChapter,
  type NewComic
} from '@shared/db'
import { normalizeExternalIds, toExternalIdKey } from '@shared/identity'
import { comicUnitIdentityKey, isSameChapterAcrossVolumeKnowledge } from '@shared/metadata'
import type { ComicChapterInfo } from '@shared/metadata'
import type { ComicChapterUpdatePlan, ComicLinkKind, ComicUpdatePlan } from './types'
import type { UpdateLinkApplyResult } from '../types'
import { areScalarValuesEqual } from '../shared/merge'
import { applyMediaRelationFacts } from '../../persist/media-relations'
import {
  applyMediaLinkGraph,
  replaceEntityExternalIds,
  replaceEntityTags,
  type ExternalIdRowSpec,
  type TagLinkRowSpec
} from '../shared/links'

const COMIC_EXTERNAL_ID_SPEC: ExternalIdRowSpec = {
  table: comicExternalIds,
  entityIdColumn: comicExternalIds.comicId,
  entityIdField: 'comicId',
  orderField: 'orderInComic'
}

const COMIC_TAG_LINK_SPEC: TagLinkRowSpec = {
  table: comicTagLinks,
  entityIdColumn: comicTagLinks.comicId,
  entityIdField: 'comicId',
  orderInEntityField: 'orderInComic'
}

interface ChapterMatch {
  row: ComicChapter
  chapter: ComicChapterInfo
  /** Position in the authoritative incoming list, written to `orderInComic`. */
  order: number
}

/** Scrape-owned metadata refresh; read state and covers are never touched. */
function updateMatchedChapter(tx: DbContext, match: ChapterMatch): void {
  const { row, chapter, order } = match
  const patch: Partial<ComicChapter> = {}

  // Realignment is the point: an id-matched row takes the source's current
  // numbering. Fields the source omitted stay as stored, because unit fields
  // carry no known-empty marker.
  const volumeNumber = chapter.volumeNumber ?? null
  const chapterNumber = chapter.chapterNumber ?? null
  if (volumeNumber !== row.volumeNumber) patch.volumeNumber = volumeNumber
  if (chapterNumber !== row.chapterNumber) patch.chapterNumber = chapterNumber
  if (order !== row.orderInComic) patch.orderInComic = order
  if (chapter.name !== undefined && chapter.name !== (row.name ?? undefined)) {
    patch.name = chapter.name
  }
  if (
    chapter.originalName !== undefined &&
    chapter.originalName !== (row.originalName ?? undefined)
  ) {
    patch.originalName = chapter.originalName
  }
  if (
    chapter.releaseDate !== undefined &&
    !areScalarValuesEqual(row.releaseDate, chapter.releaseDate)
  ) {
    patch.releaseDate = chapter.releaseDate
  }
  if (chapter.description !== undefined && chapter.description !== (row.description ?? undefined)) {
    patch.description = chapter.description
  }

  if (Object.keys(patch).length > 0) {
    tx.update(comicChapters).set(patch).where(eq(comicChapters.id, row.id)).run()
  }
}

/**
 * Reconcile stored unit rows against the authoritative incoming list.
 *
 * Incoming units claim stored rows by shared external id first, then by number
 * at the same grain for rows no id claimed; sources revise numbering, so
 * identity outranks position. Matched rows refresh scraped metadata but never
 * read state (`read`/`readAt`/`readCount`/`resumePage`). Unclaimed incoming
 * units insert with their identity. Stored rows the source no longer lists are
 * deleted only under `replace` and only when nothing user-owned hangs off them:
 * not read, no readable files, no sessions. `merge` never deletes.
 *
 * Covers are filled, never replaced: a stored `coverFile` outranks any scrape,
 * so the returned tasks only cover new rows and rows that still have none.
 */
function reconcileComicChapters(
  tx: DbContext,
  comicId: string,
  plan: ComicChapterUpdatePlan
): PendingAssetTask[] {
  const existing = tx.select().from(comicChapters).where(eq(comicChapters.comicId, comicId)).all()
  const existingIds = existing.map((row) => row.id)
  const idRows = existingIds.length
    ? tx
        .select()
        .from(comicChapterExternalIds)
        .where(inArray(comicChapterExternalIds.chapterId, existingIds))
        .all()
    : []

  const chapterIdByExternalKey = new Map<string, string>()
  const externalKeysByChapterId = new Map<string, Set<string>>()
  for (const row of idRows) {
    const key = toExternalIdKey({ source: row.source, id: row.externalId })
    if (!chapterIdByExternalKey.has(key)) {
      chapterIdByExternalKey.set(key, row.chapterId)
    }
    const keys = externalKeysByChapterId.get(row.chapterId) ?? new Set<string>()
    keys.add(key)
    externalKeysByChapterId.set(row.chapterId, keys)
  }

  const rowById = new Map(existing.map((row) => [row.id, row]))
  const claimedRowIds = new Set<string>()
  const matches: ChapterMatch[] = []
  const numberPass: Array<{ chapter: ComicChapterInfo; order: number }> = []

  for (const [order, chapter] of plan.items.entries()) {
    let claimedId: string | undefined
    for (const extId of normalizeExternalIds(chapter.externalIds)) {
      const candidate = chapterIdByExternalKey.get(toExternalIdKey(extId))
      if (candidate && !claimedRowIds.has(candidate)) {
        claimedId = candidate
        break
      }
    }

    if (claimedId) {
      claimedRowIds.add(claimedId)
      matches.push({ row: rowById.get(claimedId) as ComicChapter, chapter, order })
    } else {
      numberPass.push({ chapter, order })
    }
  }

  // Named unnumbered units are claimable too, so an extra stops being
  // re-inserted on every re-scrape.
  const rowsByIdentity = new Map<string, ComicChapter[]>()
  for (const row of existing) {
    if (claimedRowIds.has(row.id)) continue
    const key = comicUnitIdentityKey(row)
    const queue = rowsByIdentity.get(key) ?? []
    queue.push(row)
    rowsByIdentity.set(key, queue)
  }

  const inserts: Array<{ chapter: ComicChapterInfo; order: number }> = []
  for (const { chapter, order } of numberPass) {
    const row =
      rowsByIdentity.get(comicUnitIdentityKey(chapter))?.shift() ??
      claimChapterAcrossVolumeKnowledge(chapter, existing, claimedRowIds)
    if (row) {
      claimedRowIds.add(row.id)
      matches.push({ row, chapter, order })
    } else {
      inserts.push({ chapter, order })
    }
  }

  // Deletions run first so identities freed by removed rows can re-attach to
  // the rows the source now lists (unit ids are globally unique).
  if (plan.mode === 'replace') {
    const leftovers = existing.filter((row) => !claimedRowIds.has(row.id))
    if (leftovers.length > 0) {
      const leftoverIds = leftovers.map((row) => row.id)
      const referencedIds = new Set<string>([
        ...tx
          .select()
          .from(comicChapterFiles)
          .where(inArray(comicChapterFiles.chapterId, leftoverIds))
          .all()
          .map((row) => row.chapterId),
        ...tx
          .select()
          .from(comicSessions)
          .where(inArray(comicSessions.chapterId, leftoverIds))
          .all()
          .flatMap((row) => (row.chapterId ? [row.chapterId] : []))
      ])

      for (const row of leftovers) {
        if (row.read || referencedIds.has(row.id)) continue
        tx.delete(comicChapters).where(eq(comicChapters.id, row.id)).run()
      }
    }
  }

  const pendingAssets: PendingAssetTask[] = []

  for (const match of matches) {
    updateMatchedChapter(tx, match)

    const knownKeys = externalKeysByChapterId.get(match.row.id) ?? new Set<string>()
    const missingIds = normalizeExternalIds(match.chapter.externalIds).filter(
      (extId) => !knownKeys.has(toExternalIdKey(extId))
    )
    if (missingIds.length > 0) {
      insertComicChapterExternalIds(tx, match.row.id, missingIds, knownKeys.size)
    }

    if (match.row.coverFile === null && match.chapter.coverUrl) {
      pendingAssets.push(toChapterCoverTask(match.row.id, match.chapter.coverUrl))
    }
  }

  for (const { chapter, order } of inserts) {
    const chapterId = insertComicChapterRow(tx, comicId, chapter, order)
    if (chapter.coverUrl) {
      pendingAssets.push(toChapterCoverTask(chapterId, chapter.coverUrl))
    }
  }

  return pendingAssets
}

function toChapterCoverTask(chapterId: string, url: string): PendingAssetTask {
  return { table: 'comic_chapters', rowId: chapterId, field: 'coverFile', url }
}

/**
 * Second realignment pass: the source learned or forgot which volume collected
 * a chapter, so the existing row is the same installment under a different
 * identity key. Only an unambiguous single candidate is claimed.
 */
function claimChapterAcrossVolumeKnowledge(
  chapter: ComicChapterInfo,
  existing: ComicChapter[],
  claimedRowIds: ReadonlySet<string>
): ComicChapter | undefined {
  const candidates = existing.filter(
    (row) => !claimedRowIds.has(row.id) && isSameChapterAcrossVolumeKnowledge(chapter, row)
  )
  return candidates.length === 1 ? candidates[0] : undefined
}

export function applyComicPlan(
  tx: DbContext,
  comicId: string,
  plan: ComicUpdatePlan,
  persisters: IngestPersisters
): UpdateLinkApplyResult<ComicLinkKind> {
  if (plan.externalIds) {
    requireExternalIdsAvailable(tx, comicExternalIdLink, [comicId], plan.externalIds)
    replaceEntityExternalIds(tx, COMIC_EXTERNAL_ID_SPEC, comicId, plan.externalIds)
  }

  if (plan.tags) {
    replaceEntityTags(tx, COMIC_TAG_LINK_SPEC, comicId, plan.tags)
  }

  if (Object.keys(plan.patch).length > 0) {
    tx.update(comics)
      .set(plan.patch as Partial<NewComic>)
      .where(eq(comics.id, comicId))
      .run()
  }

  const chapterAssets = plan.chapters ? reconcileComicChapters(tx, comicId, plan.chapters) : []

  const plannedMedia: Array<[string, string | undefined]> = [
    ['coverFile', plan.coverUrl],
    ['backdropFile', plan.backdropUrl],
    ['logoFile', plan.logoUrl]
  ]
  const pendingAssets: PendingAssetTask[] = plannedMedia
    .filter(([, url]) => Boolean(url))
    .map(([field, url]) => ({ table: 'comics', rowId: comicId, field, url: url as string }))
  pendingAssets.push(...chapterAssets)

  const relationGraph = plan.relationGraph
  const relations = relationGraph
    ? applyMediaLinkGraph({
        tx,
        entityId: comicId,
        persisters,
        nodes: relationGraph,
        person: {
          kind: 'comicPerson',
          mode: plan.links.comicPerson,
          links: relationGraph.links.comicPerson
        },
        company: {
          kind: 'comicCompany',
          mode: plan.links.comicCompany,
          links: relationGraph.links.comicCompany
        },
        character: {
          kind: 'comicCharacter',
          mode: plan.links.comicCharacter,
          links: relationGraph.links.comicCharacter
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
      mediaType: 'comic',
      entityId: comicId,
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
