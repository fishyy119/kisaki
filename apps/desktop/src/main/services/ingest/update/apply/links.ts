/**
 * Link-row application for metadata updates.
 *
 * One generic load/replace/apply pipeline drives every link table; per-table
 * differences are declared as schema facts in `LINK_ROW_SPECS`. Row semantics:
 * `replace` makes the stored set equal the incoming one, `merge` only adds,
 * duplicate rows OR their spoiler flags and keep the first non-empty note.
 */

import { eq } from 'drizzle-orm'
import type { AnySQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { DbContext, DbQueryContext, DbWriteContext } from '@main/services/db'
import {
  animeCharacterLinks,
  animeCompanyLinks,
  animePersonLinks,
  characterPersonLinks,
  gameCharacterLinks,
  gameCompanyLinks,
  gamePersonLinks
} from '@shared/db'
import type { IngestUpdatePolicy } from '@shared/ingest/update'
import { IngestPersistHandlers } from '../../persist'
import type { PendingAssetTask } from '../../assets'
import type { IngestCharacterGraph, IngestCharacterNode, IngestGameGraph } from '../../graph'
import { normalizeOptionalString } from '../shared/normalization'

/** One stored or incoming link row, reduced to the fields update semantics compare. */
interface OrderedLinkRow {
  relatedId: string
  role: string
  isSpoiler: boolean
  note: string | null
}

/** Schema facts of one link table, viewed from the entity side being updated. */
interface LinkRowSpec {
  table: SQLiteTable
  entityIdColumn: AnySQLiteColumn
  entityIdField: string
  relatedIdField: string
  orderInEntityField: string
  orderInRelatedField: string
}

const LINK_ROW_SPECS = {
  gamePerson: {
    table: gamePersonLinks,
    entityIdColumn: gamePersonLinks.gameId,
    entityIdField: 'gameId',
    relatedIdField: 'personId',
    orderInEntityField: 'orderInGame',
    orderInRelatedField: 'orderInPerson'
  },
  gameCompany: {
    table: gameCompanyLinks,
    entityIdColumn: gameCompanyLinks.gameId,
    entityIdField: 'gameId',
    relatedIdField: 'companyId',
    orderInEntityField: 'orderInGame',
    orderInRelatedField: 'orderInCompany'
  },
  gameCharacter: {
    table: gameCharacterLinks,
    entityIdColumn: gameCharacterLinks.gameId,
    entityIdField: 'gameId',
    relatedIdField: 'characterId',
    orderInEntityField: 'orderInGame',
    orderInRelatedField: 'orderInCharacter'
  },
  animePerson: {
    table: animePersonLinks,
    entityIdColumn: animePersonLinks.animeId,
    entityIdField: 'animeId',
    relatedIdField: 'personId',
    orderInEntityField: 'orderInAnime',
    orderInRelatedField: 'orderInPerson'
  },
  animeCompany: {
    table: animeCompanyLinks,
    entityIdColumn: animeCompanyLinks.animeId,
    entityIdField: 'animeId',
    relatedIdField: 'companyId',
    orderInEntityField: 'orderInAnime',
    orderInRelatedField: 'orderInCompany'
  },
  animeCharacter: {
    table: animeCharacterLinks,
    entityIdColumn: animeCharacterLinks.animeId,
    entityIdField: 'animeId',
    relatedIdField: 'characterId',
    orderInEntityField: 'orderInAnime',
    orderInRelatedField: 'orderInCharacter'
  },
  characterPerson: {
    table: characterPersonLinks,
    entityIdColumn: characterPersonLinks.characterId,
    entityIdField: 'characterId',
    relatedIdField: 'personId',
    orderInEntityField: 'orderInCharacter',
    orderInRelatedField: 'orderInPerson'
  }
} as const satisfies Record<string, LinkRowSpec>

export type LinkRowKind = keyof typeof LINK_ROW_SPECS

function normalizeLinkNote(note: string | null | undefined): string | null {
  return normalizeOptionalString(note) ?? null
}

function linkRowKey(row: OrderedLinkRow): string {
  return `${row.relatedId}:${row.role}`
}

function areLinkRowsEqual(current: OrderedLinkRow[], next: OrderedLinkRow[]): boolean {
  if (current.length !== next.length) return false

  return current.every((row, index) => {
    const candidate = next[index]
    return (
      row.relatedId === candidate.relatedId &&
      row.role === candidate.role &&
      row.isSpoiler === candidate.isSpoiler &&
      normalizeLinkNote(row.note) === normalizeLinkNote(candidate.note)
    )
  })
}

interface LinkRowPlan {
  /** Rows to persist, or `undefined` when the stored rows already stand. */
  rows?: OrderedLinkRow[]
  /** Stored rows absent from the incoming set, which `replace` would have deleted. */
  preservedRowCount: number
}

/**
 * Resolve stored link rows against the authoritative incoming ones.
 * `replace` makes the stored set equal the incoming one, so empty incoming rows
 * clear the table; `merge` only adds, so empty incoming rows change nothing.
 */
function buildFinalLinkRows(
  current: OrderedLinkRow[],
  incoming: OrderedLinkRow[],
  collectionMode: IngestUpdatePolicy['collectionUpdate']
): LinkRowPlan {
  if (collectionMode === 'replace') {
    return {
      rows: incoming.map((row) => ({ ...row, note: normalizeLinkNote(row.note) })),
      preservedRowCount: 0
    }
  }

  const incomingKeys = new Set(incoming.map(linkRowKey))
  const preservedRowCount = current.filter((row) => !incomingKeys.has(linkRowKey(row))).length

  if (incoming.length === 0) return { preservedRowCount }

  const merged = current.map((row) => ({ ...row, note: normalizeLinkNote(row.note) }))
  const indexByKey = new Map(merged.map((row, index) => [linkRowKey(row), index]))

  for (const row of incoming) {
    const key = linkRowKey(row)
    const existingIndex = indexByKey.get(key)
    if (existingIndex === undefined) {
      indexByKey.set(key, merged.length)
      merged.push({ ...row, note: normalizeLinkNote(row.note) })
      continue
    }

    const currentRow = merged[existingIndex]
    merged[existingIndex] = {
      ...currentRow,
      isSpoiler: currentRow.isSpoiler || row.isSpoiler,
      note: normalizeLinkNote(currentRow.note) ?? normalizeLinkNote(row.note)
    }
  }

  return { rows: merged, preservedRowCount }
}

function toOrderValue(value: unknown): number {
  return typeof value === 'number' ? value : 0
}

function loadLinkRows(tx: DbContext, spec: LinkRowSpec, entityId: string): OrderedLinkRow[] {
  const rows = (tx as DbQueryContext)
    .select()
    .from(spec.table)
    .where(eq(spec.entityIdColumn, entityId))
    .all() as Record<string, unknown>[]

  return rows
    .sort(
      (a, b) =>
        toOrderValue(a[spec.orderInEntityField]) - toOrderValue(b[spec.orderInEntityField]) ||
        toOrderValue(a[spec.orderInRelatedField]) - toOrderValue(b[spec.orderInRelatedField])
    )
    .map((row) => ({
      relatedId: String(row[spec.relatedIdField]),
      role: String(row.role),
      isSpoiler: Boolean(row.isSpoiler),
      note: normalizeLinkNote(row.note as string | null)
    }))
}

function replaceLinkRows(
  tx: DbContext,
  spec: LinkRowSpec,
  entityId: string,
  rows: OrderedLinkRow[]
): void {
  ;(tx as DbWriteContext).delete(spec.table).where(eq(spec.entityIdColumn, entityId)).run()
  if (rows.length === 0) return

  const relatedOrderCounters = new Map<string, number>()
  const values = rows.map((row, orderInEntity) => {
    const orderInRelated = relatedOrderCounters.get(row.relatedId) ?? 0
    relatedOrderCounters.set(row.relatedId, orderInRelated + 1)

    return {
      [spec.entityIdField]: entityId,
      [spec.relatedIdField]: row.relatedId,
      role: row.role,
      isSpoiler: row.isSpoiler,
      note: normalizeLinkNote(row.note),
      [spec.orderInEntityField]: orderInEntity,
      [spec.orderInRelatedField]: orderInRelated
    }
  })

  ;(tx as DbWriteContext).insert(spec.table).values(values).run()
}

/**
 * Applies incoming link rows for one entity and one link table.
 * Links whose related endpoint did not resolve are skipped.
 * @returns How many stored rows a `replace` would have deleted but merge kept.
 */
export function applyLinkRows<
  TLink extends { role: string; isSpoiler: boolean; note?: string | null }
>(params: {
  tx: DbContext
  kind: LinkRowKind
  entityId: string
  links: readonly TLink[]
  relatedIdentityKeyOf: (link: TLink) => string
  relatedIdByIdentity: ReadonlyMap<string, string>
  collectionMode: IngestUpdatePolicy['collectionUpdate']
}): number {
  const { tx, kind, entityId, links, relatedIdentityKeyOf, relatedIdByIdentity, collectionMode } =
    params
  const spec = LINK_ROW_SPECS[kind]

  const incomingRows: OrderedLinkRow[] = []
  for (const link of links) {
    const relatedId = relatedIdByIdentity.get(relatedIdentityKeyOf(link))
    if (!relatedId) continue

    incomingRows.push({
      relatedId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: normalizeLinkNote(link.note)
    })
  }

  const currentRows = loadLinkRows(tx, spec, entityId)
  const rowPlan = buildFinalLinkRows(currentRows, incomingRows, collectionMode)
  if (rowPlan.rows && !areLinkRowsEqual(currentRows, rowPlan.rows)) {
    replaceLinkRows(tx, spec, entityId, rowPlan.rows)
  }

  return rowPlan.preservedRowCount
}

export function resolvePersonNodes(
  tx: DbContext,
  persistHandlers: IngestPersistHandlers,
  nodes: IngestCharacterGraph['persons'] | IngestGameGraph['persons']
): {
  idByIdentity: Map<string, string>
  pendingAssets: PendingAssetTask[]
} {
  const idByIdentity = new Map<string, string>()
  const pendingAssets: PendingAssetTask[] = []

  for (const node of nodes) {
    const result = persistHandlers.person.persistPersonNodeInternal(node, tx)
    idByIdentity.set(node.identityKey, result.personId)
    pendingAssets.push(...result.pendingAssets)
  }

  return { idByIdentity, pendingAssets }
}

export function filterNodesByIdentity<T extends { identityKey: string }>(
  nodes: readonly T[],
  identityKeys: ReadonlySet<string>
): T[] {
  if (identityKeys.size === 0) {
    return []
  }

  return nodes.filter((node) => identityKeys.has(node.identityKey))
}

export function resolveCompanyNodes(
  tx: DbContext,
  persistHandlers: IngestPersistHandlers,
  nodes: IngestGameGraph['companies']
): {
  idByIdentity: Map<string, string>
  pendingAssets: PendingAssetTask[]
} {
  const idByIdentity = new Map<string, string>()
  const pendingAssets: PendingAssetTask[] = []

  for (const node of nodes) {
    const result = persistHandlers.company.persistCompanyNodeInternal(node, tx)
    idByIdentity.set(node.identityKey, result.companyId)
    pendingAssets.push(...result.pendingAssets)
  }

  return { idByIdentity, pendingAssets }
}

export function resolveCharacterNodes(
  tx: DbContext,
  persistHandlers: IngestPersistHandlers,
  nodes: IngestGameGraph['characters'] | IngestCharacterNode[]
): {
  idByIdentity: Map<string, string>
  pendingAssets: PendingAssetTask[]
} {
  const idByIdentity = new Map<string, string>()
  const pendingAssets: PendingAssetTask[] = []

  for (const node of nodes) {
    const result = persistHandlers.character.persistCharacterNodeInternal(node, tx)
    idByIdentity.set(node.identityKey, result.characterId)
    pendingAssets.push(...result.pendingAssets)
  }

  return { idByIdentity, pendingAssets }
}
