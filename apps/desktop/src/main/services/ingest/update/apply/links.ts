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
import {
  resolveTagId,
  type DbContext,
  type DbQueryContext,
  type DbWriteContext
} from '@main/services/db'
import {
  animeCastLinks,
  animeCharacterLinks,
  animeCompanyLinks,
  animePersonLinks,
  characterPersonLinks,
  comicCharacterLinks,
  comicCompanyLinks,
  comicPersonLinks,
  gameCastLinks,
  gameCharacterLinks,
  gameCompanyLinks,
  gamePersonLinks,
  novelCharacterLinks,
  novelCompanyLinks,
  novelPersonLinks
} from '@shared/db'
import type { IngestUpdatePolicy } from '@shared/ingest/update'
import { normalizeExternalIds, type ExternalId } from '@shared/identity'
import { IngestPersistHandlers } from '../../persist'
import type { PendingAssetTask } from '../../assets'
import type {
  IngestCharacterGraph,
  IngestCharacterNode,
  IngestCharacterPersonLink,
  IngestGameGraph
} from '../../graph'
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
  comicPerson: {
    table: comicPersonLinks,
    entityIdColumn: comicPersonLinks.comicId,
    entityIdField: 'comicId',
    relatedIdField: 'personId',
    orderInEntityField: 'orderInComic',
    orderInRelatedField: 'orderInPerson'
  },
  comicCompany: {
    table: comicCompanyLinks,
    entityIdColumn: comicCompanyLinks.comicId,
    entityIdField: 'comicId',
    relatedIdField: 'companyId',
    orderInEntityField: 'orderInComic',
    orderInRelatedField: 'orderInCompany'
  },
  comicCharacter: {
    table: comicCharacterLinks,
    entityIdColumn: comicCharacterLinks.comicId,
    entityIdField: 'comicId',
    relatedIdField: 'characterId',
    orderInEntityField: 'orderInComic',
    orderInRelatedField: 'orderInCharacter'
  },
  novelPerson: {
    table: novelPersonLinks,
    entityIdColumn: novelPersonLinks.novelId,
    entityIdField: 'novelId',
    relatedIdField: 'personId',
    orderInEntityField: 'orderInNovel',
    orderInRelatedField: 'orderInPerson'
  },
  novelCompany: {
    table: novelCompanyLinks,
    entityIdColumn: novelCompanyLinks.novelId,
    entityIdField: 'novelId',
    relatedIdField: 'companyId',
    orderInEntityField: 'orderInNovel',
    orderInRelatedField: 'orderInCompany'
  },
  novelCharacter: {
    table: novelCharacterLinks,
    entityIdColumn: novelCharacterLinks.novelId,
    entityIdField: 'novelId',
    relatedIdField: 'characterId',
    orderInEntityField: 'orderInNovel',
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
  TLink extends {
    role: string
    isSpoiler: boolean
    note?: string | null
  }
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

/** Schema facts of one cast table, viewed from the media entry being updated. */
interface CastRowSpec {
  table: SQLiteTable
  entityIdColumn: AnySQLiteColumn
  entityIdField: string
}

const CAST_ROW_SPECS = {
  gameCast: {
    table: gameCastLinks,
    entityIdColumn: gameCastLinks.gameId,
    entityIdField: 'gameId'
  },
  animeCast: {
    table: animeCastLinks,
    entityIdColumn: animeCastLinks.animeId,
    entityIdField: 'animeId'
  }
} as const satisfies Record<string, CastRowSpec>

export type CastRowKind = keyof typeof CAST_ROW_SPECS

interface CastRow {
  characterId: string
  personId: string
  note: string | null
}

function castRowKey(row: CastRow): string {
  return `${row.characterId}:${row.personId}`
}

/**
 * Applies an entry's voice credits.
 *
 * Cast rows are a set rather than a list: the pairing is the whole fact, so
 * they carry no order and are compared by their two endpoints alone.
 */
export function applyCastRows(params: {
  tx: DbContext
  kind: CastRowKind
  entityId: string
  links: readonly { characterIdentityKey: string; personIdentityKey: string; note?: string }[]
  characterIdByIdentity: ReadonlyMap<string, string>
  personIdByIdentity: ReadonlyMap<string, string>
  collectionMode: IngestUpdatePolicy['collectionUpdate']
}): number {
  const { tx, kind, entityId, links, characterIdByIdentity, personIdByIdentity, collectionMode } =
    params
  const spec = CAST_ROW_SPECS[kind]

  const incomingByKey = new Map<string, CastRow>()
  for (const link of links) {
    const characterId = characterIdByIdentity.get(link.characterIdentityKey)
    const personId = personIdByIdentity.get(link.personIdentityKey)
    if (!characterId || !personId) continue

    const row: CastRow = { characterId, personId, note: normalizeLinkNote(link.note) }
    if (!incomingByKey.has(castRowKey(row))) incomingByKey.set(castRowKey(row), row)
  }

  const storedRows = (tx as DbQueryContext)
    .select()
    .from(spec.table)
    .where(eq(spec.entityIdColumn, entityId))
    .all() as Record<string, unknown>[]
  const currentByKey = new Map<string, CastRow>()
  for (const stored of storedRows) {
    const row: CastRow = {
      characterId: String(stored.characterId),
      personId: String(stored.personId),
      note: normalizeLinkNote(stored.note as string | null)
    }
    currentByKey.set(castRowKey(row), row)
  }

  const preservedRowCount = [...currentByKey.keys()].filter((key) => !incomingByKey.has(key)).length

  const finalByKey =
    collectionMode === 'replace' ? incomingByKey : new Map([...currentByKey, ...incomingByKey])
  if (collectionMode === 'merge' && incomingByKey.size === 0) return preservedRowCount

  const unchanged =
    finalByKey.size === currentByKey.size &&
    [...finalByKey].every(([key, row]) => currentByKey.get(key)?.note === row.note)
  if (unchanged) return preservedRowCount

  ;(tx as DbWriteContext).delete(spec.table).where(eq(spec.entityIdColumn, entityId)).run()
  const values = [...finalByKey.values()].map((row) => ({
    [spec.entityIdField]: entityId,
    characterId: row.characterId,
    personId: row.personId,
    note: row.note
  }))
  if (values.length > 0) {
    ;(tx as DbWriteContext).insert(spec.table).values(values).run()
  }

  return preservedRowCount
}

/** Schema facts of one entity's external-id table. */
export interface ExternalIdRowSpec {
  table: SQLiteTable
  entityIdColumn: AnySQLiteColumn
  entityIdField: string
  orderField: string
}

/** Replaces an entity's external-id rows with the normalized incoming set. */
export function replaceEntityExternalIds(
  tx: DbContext,
  spec: ExternalIdRowSpec,
  entityId: string,
  externalIds: ExternalId[]
): void {
  ;(tx as DbWriteContext).delete(spec.table).where(eq(spec.entityIdColumn, entityId)).run()

  const values = normalizeExternalIds(externalIds).map((externalId, index) => ({
    [spec.entityIdField]: entityId,
    source: externalId.source,
    externalId: externalId.id,
    [spec.orderField]: index
  }))

  if (values.length > 0) {
    ;(tx as DbWriteContext).insert(spec.table).values(values).run()
  }
}

/** Schema facts of one entity's tag-link table. */
export interface TagLinkRowSpec {
  table: SQLiteTable
  entityIdColumn: AnySQLiteColumn
  entityIdField: string
  orderInEntityField: string
}

type UpdateTagInput = Parameters<typeof resolveTagId>[1] & {
  isSpoiler?: boolean
  note?: string | null
}

/** Replaces an entity's tag links, resolving or creating tags by identity. */
export function replaceEntityTags(
  tx: DbContext,
  spec: TagLinkRowSpec,
  entityId: string,
  nextTags: readonly UpdateTagInput[] | undefined
): void {
  ;(tx as DbWriteContext).delete(spec.table).where(eq(spec.entityIdColumn, entityId)).run()
  if (!nextTags?.length) return

  const values: Record<string, unknown>[] = []
  nextTags.forEach((tag, index) => {
    const tagId = resolveTagId(tx, tag)
    if (!tagId) return

    values.push({
      [spec.entityIdField]: entityId,
      tagId,
      isSpoiler: tag.isSpoiler ?? false,
      note: tag.note ?? null,
      [spec.orderInEntityField]: index,
      orderInTag: 0
    })
  })

  if (values.length > 0) {
    ;(tx as DbWriteContext).insert(spec.table).values(values).run()
  }
}

interface NodeResolution {
  idByIdentity: Map<string, string>
  pendingAssets: PendingAssetTask[]
}

const EMPTY_RESOLUTION: NodeResolution = { idByIdentity: new Map(), pendingAssets: [] }

/** One media-side link family: its link-table kind, resolved mode, and graph rows. */
export interface MediaGraphLinkInput<
  K extends LinkRowKind,
  TLink extends {
    role: string
    isSpoiler: boolean
    note?: string | null
  }
> {
  kind: K
  mode: IngestUpdatePolicy['collectionUpdate'] | undefined
  links: readonly TLink[]
}

/**
 * Applies a media entry's scraped relation graph: resolves the satellite
 * nodes the planned link tables actually reference (creating missing ones)
 * and reconciles the person/company/character link tables, the entry's cast
 * when the media type carries one, and the character-person rows reachable
 * through them. Parameterized only by link-table kinds and graph rows; print
 * media simply omits the `cast` input.
 */
export function applyMediaLinkGraph<K extends LinkRowKind, C extends CastRowKind>(params: {
  tx: DbContext
  entityId: string
  persistHandlers: IngestPersistHandlers
  nodes: {
    persons: IngestGameGraph['persons']
    companies: IngestGameGraph['companies']
    characters: IngestGameGraph['characters']
  }
  person: MediaGraphLinkInput<
    K,
    {
      personIdentityKey: string
      role: string
      isSpoiler: boolean
      note?: string | null
    }
  >
  company: MediaGraphLinkInput<
    K,
    { companyIdentityKey: string; role: string; isSpoiler: boolean; note?: string | null }
  >
  character: MediaGraphLinkInput<
    K,
    { characterIdentityKey: string; role: string; isSpoiler: boolean; note?: string | null }
  >
  cast?: {
    kind: C
    mode: IngestUpdatePolicy['collectionUpdate'] | undefined
    links: readonly { characterIdentityKey: string; personIdentityKey: string; note?: string }[]
  }
  characterPerson: {
    mode: IngestUpdatePolicy['collectionUpdate'] | undefined
    links: readonly IngestCharacterPersonLink[]
  }
}): {
  pendingAssets: PendingAssetTask[]
  preservedLinkRows: Partial<Record<K | C | 'characterPerson', number>>
} {
  const {
    tx,
    entityId,
    persistHandlers,
    nodes,
    person,
    company,
    character,
    cast,
    characterPerson
  } = params

  const personIdentityKeys = new Set<string>()
  if (person.mode) {
    for (const link of person.links) personIdentityKeys.add(link.personIdentityKey)
  }
  if (characterPerson.mode) {
    for (const link of characterPerson.links) personIdentityKeys.add(link.personIdentityKey)
  }
  if (cast?.mode) {
    for (const link of cast.links) personIdentityKeys.add(link.personIdentityKey)
  }

  const companyIdentityKeys = new Set<string>()
  if (company.mode) {
    for (const link of company.links) companyIdentityKeys.add(link.companyIdentityKey)
  }

  const characterIdentityKeys = new Set<string>()
  if (character.mode) {
    for (const link of character.links) characterIdentityKeys.add(link.characterIdentityKey)
  }
  if (characterPerson.mode) {
    for (const link of characterPerson.links) characterIdentityKeys.add(link.characterIdentityKey)
  }
  if (cast?.mode) {
    for (const link of cast.links) characterIdentityKeys.add(link.characterIdentityKey)
  }

  const pendingAssets: PendingAssetTask[] = []
  const preservedLinkRows: Partial<Record<K | C | 'characterPerson', number>> = {}

  const personResolution =
    personIdentityKeys.size > 0
      ? resolvePersonNodes(
          tx,
          persistHandlers,
          filterNodesByIdentity(nodes.persons, personIdentityKeys)
        )
      : EMPTY_RESOLUTION
  pendingAssets.push(...personResolution.pendingAssets)

  const companyResolution =
    companyIdentityKeys.size > 0
      ? resolveCompanyNodes(
          tx,
          persistHandlers,
          filterNodesByIdentity(nodes.companies, companyIdentityKeys)
        )
      : EMPTY_RESOLUTION
  pendingAssets.push(...companyResolution.pendingAssets)

  const characterResolution =
    characterIdentityKeys.size > 0
      ? resolveCharacterNodes(
          tx,
          persistHandlers,
          filterNodesByIdentity(nodes.characters, characterIdentityKeys)
        )
      : EMPTY_RESOLUTION
  pendingAssets.push(...characterResolution.pendingAssets)

  if (person.mode) {
    preservedLinkRows[person.kind] = applyLinkRows({
      tx,
      kind: person.kind,
      entityId,
      links: person.links,
      relatedIdentityKeyOf: (link) => link.personIdentityKey,
      relatedIdByIdentity: personResolution.idByIdentity,
      collectionMode: person.mode
    })
  }

  if (company.mode) {
    preservedLinkRows[company.kind] = applyLinkRows({
      tx,
      kind: company.kind,
      entityId,
      links: company.links,
      relatedIdentityKeyOf: (link) => link.companyIdentityKey,
      relatedIdByIdentity: companyResolution.idByIdentity,
      collectionMode: company.mode
    })
  }

  if (character.mode) {
    preservedLinkRows[character.kind] = applyLinkRows({
      tx,
      kind: character.kind,
      entityId,
      links: character.links,
      relatedIdentityKeyOf: (link) => link.characterIdentityKey,
      relatedIdByIdentity: characterResolution.idByIdentity,
      collectionMode: character.mode
    })
  }

  if (cast?.mode) {
    preservedLinkRows[cast.kind] = applyCastRows({
      tx,
      kind: cast.kind,
      entityId,
      links: cast.links,
      characterIdByIdentity: characterResolution.idByIdentity,
      personIdByIdentity: personResolution.idByIdentity,
      collectionMode: cast.mode
    })
  }

  if (characterPerson.mode) {
    const linksByCharacterId = new Map<string, IngestCharacterPersonLink[]>()
    for (const link of characterPerson.links) {
      const characterId = characterResolution.idByIdentity.get(link.characterIdentityKey)
      if (!characterId) continue

      const links = linksByCharacterId.get(characterId) ?? []
      links.push(link)
      linksByCharacterId.set(characterId, links)
    }

    let preserved = 0
    for (const [characterId, links] of linksByCharacterId) {
      preserved += applyLinkRows({
        tx,
        kind: 'characterPerson',
        entityId: characterId,
        links,
        relatedIdentityKeyOf: (link) => link.personIdentityKey,
        relatedIdByIdentity: personResolution.idByIdentity,
        collectionMode: characterPerson.mode
      })
    }
    preservedLinkRows.characterPerson = preserved
  }

  return { pendingAssets, preservedLinkRows }
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
