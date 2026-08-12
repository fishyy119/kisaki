/**
 * Media-relation fact application.
 *
 * Scraped related entries reference their targets by external identity only.
 * This applier resolves them against library entries — scraping never creates
 * media entries — and writes the entity's outgoing edges. Unresolved or
 * pair-invalid facts are dropped and counted so callers can surface a warning.
 */

import { and, asc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { MediaType } from '@shared/common'
import {
  getMediaRelationTypeRules,
  mediaRelations,
  type MediaRelationType,
  type NewMediaRelation
} from '@shared/db'
import type { IngestUpdatePolicy } from '@shared/ingest/update'
import type { ScrapedRelatedEntryFact } from '@shared/scraper'
import {
  animeExternalIdLink,
  findExternalIdOwners,
  gameExternalIdLink,
  type DbContext,
  type ExternalIdLinkTable
} from '@main/services/db'
import { normalizeExternalId } from '@shared/identity'
import { normalizeOptionalString } from './update/shared/normalization'

const EXTERNAL_ID_LINK_BY_MEDIA_TYPE: Record<MediaType, ExternalIdLinkTable> = {
  game: gameExternalIdLink,
  anime: animeExternalIdLink
}

interface ResolvedRelationRow {
  toType: MediaType
  toId: string
  type: MediaRelationType
  note: string | null
}

export interface ApplyMediaRelationFactsResult {
  /** Facts whose target did not resolve to a library entry. */
  unresolvedCount: number
}

/**
 * Applies scraped related-entry facts as the entity's outgoing edges.
 * `replace` makes the stored out-edge set equal the resolved incoming one;
 * `merge` only adds. Duplicate edges keep the first non-empty note.
 */
export function applyMediaRelationFacts(params: {
  tx: DbContext
  mediaType: MediaType
  entityId: string
  facts: readonly ScrapedRelatedEntryFact[]
  collectionMode: IngestUpdatePolicy['collectionUpdate']
}): ApplyMediaRelationFactsResult {
  const { tx, mediaType, entityId, facts, collectionMode } = params

  const { rows: incomingRows, unresolvedCount } = resolveRelationRows(
    tx,
    mediaType,
    entityId,
    facts
  )

  const currentRows = tx
    .select()
    .from(mediaRelations)
    .where(and(eq(mediaRelations.fromType, mediaType), eq(mediaRelations.fromId, entityId)))
    .orderBy(asc(mediaRelations.orderInFrom), asc(mediaRelations.createdAt))
    .all()
    .map(
      (row): ResolvedRelationRow => ({
        toType: row.toType,
        toId: row.toId,
        type: row.type,
        note: row.note
      })
    )

  const finalRows = buildFinalRelationRows(currentRows, incomingRows, collectionMode)

  if (finalRows && !areRelationRowsEqual(currentRows, finalRows)) {
    replaceOutgoingRows(tx, mediaType, entityId, finalRows)
  }

  return { unresolvedCount }
}

function resolveRelationRows(
  tx: DbContext,
  mediaType: MediaType,
  entityId: string,
  facts: readonly ScrapedRelatedEntryFact[]
): { rows: ResolvedRelationRow[]; unresolvedCount: number } {
  const rows: ResolvedRelationRow[] = []
  const seen = new Set<string>()
  let unresolvedCount = 0

  for (const fact of facts) {
    // Pair-invalid vocabulary means a provider mapping bug, not missing data.
    if (!getMediaRelationTypeRules(mediaType, fact.mediaType).includes(fact.type)) continue

    const externalId = normalizeExternalId({ source: fact.source, id: fact.externalId })
    if (!externalId.source || !externalId.id) continue

    const [ownerId] = findExternalIdOwners(
      tx,
      EXTERNAL_ID_LINK_BY_MEDIA_TYPE[fact.mediaType],
      externalId
    )
    if (!ownerId) {
      unresolvedCount++
      continue
    }
    if (fact.mediaType === mediaType && ownerId === entityId) continue

    const key = `${fact.mediaType}\0${ownerId}\0${fact.type}`
    if (seen.has(key)) continue
    seen.add(key)

    rows.push({
      toType: fact.mediaType,
      toId: ownerId,
      type: fact.type,
      note: normalizeOptionalString(fact.note) ?? null
    })
  }

  return { rows, unresolvedCount }
}

function relationRowKey(row: ResolvedRelationRow): string {
  return `${row.toType}\0${row.toId}\0${row.type}`
}

/** Returns the rows to persist, or `undefined` when the stored rows already stand. */
function buildFinalRelationRows(
  current: ResolvedRelationRow[],
  incoming: ResolvedRelationRow[],
  collectionMode: IngestUpdatePolicy['collectionUpdate']
): ResolvedRelationRow[] | undefined {
  if (collectionMode === 'replace') {
    return incoming
  }

  if (incoming.length === 0) return undefined

  const merged = [...current]
  const indexByKey = new Map(merged.map((row, index) => [relationRowKey(row), index]))

  for (const row of incoming) {
    const existingIndex = indexByKey.get(relationRowKey(row))
    if (existingIndex === undefined) {
      indexByKey.set(relationRowKey(row), merged.length)
      merged.push(row)
      continue
    }

    const currentRow = merged[existingIndex]
    merged[existingIndex] = { ...currentRow, note: currentRow.note ?? row.note }
  }

  return merged
}

function areRelationRowsEqual(
  current: ResolvedRelationRow[],
  next: ResolvedRelationRow[]
): boolean {
  if (current.length !== next.length) return false

  return current.every((row, index) => {
    const candidate = next[index]
    return (
      row.toType === candidate.toType &&
      row.toId === candidate.toId &&
      row.type === candidate.type &&
      row.note === candidate.note
    )
  })
}

function replaceOutgoingRows(
  tx: DbContext,
  mediaType: MediaType,
  entityId: string,
  rows: ResolvedRelationRow[]
): void {
  tx.delete(mediaRelations)
    .where(and(eq(mediaRelations.fromType, mediaType), eq(mediaRelations.fromId, entityId)))
    .run()
  if (rows.length === 0) return

  const values: NewMediaRelation[] = rows.map((row, orderInFrom) => ({
    id: nanoid(),
    fromType: mediaType,
    fromId: entityId,
    toType: row.toType,
    toId: row.toId,
    type: row.type,
    note: row.note,
    orderInFrom
  }))
  tx.insert(mediaRelations).values(values).run()
}
