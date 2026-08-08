import { eq } from 'drizzle-orm'
import type { DbContext } from '@main/services/db'
import { IngestPersistHandlers } from '../../persist'
import type { PendingAssetTask } from '../../assets'
import type { IngestCharacterGraph, IngestGameCharacterNode, IngestGameGraph } from '../../graph'
import {
  characterPersonLinks,
  gameCharacterLinks,
  gameCompanyLinks,
  gamePersonLinks,
  type CharacterPersonType,
  type GameCharacterType,
  type GameCompanyType,
  type GamePersonType,
  type NewCharacterPersonLink,
  type NewGameCharacterLink,
  type NewGameCompanyLink,
  type NewGamePersonLink
} from '@shared/db'
import type { IngestUpdatePolicy } from '@shared/ingest/update'
import { normalizeOptionalString } from '../shared/normalization'

interface OrderedRelationRow<TType extends string> {
  relatedId: string
  type: TType
  isSpoiler: boolean
  note: string | null
}

function normalizeRelationNote(note: string | null | undefined): string | null {
  return normalizeOptionalString(note) ?? null
}

function relationRowKey<TType extends string>(row: OrderedRelationRow<TType>): string {
  return `${row.relatedId}:${row.type}`
}

function areRelationRowsEqual<TType extends string>(
  current: OrderedRelationRow<TType>[],
  next: OrderedRelationRow<TType>[]
): boolean {
  if (current.length !== next.length) return false

  return current.every((row, index) => {
    const candidate = next[index]
    return (
      row.relatedId === candidate.relatedId &&
      row.type === candidate.type &&
      row.isSpoiler === candidate.isSpoiler &&
      normalizeRelationNote(row.note) === normalizeRelationNote(candidate.note)
    )
  })
}

interface RelationRowPlan<TType extends string> {
  /** Rows to persist, or `undefined` when the stored rows already stand. */
  rows?: OrderedRelationRow<TType>[]
  /** Stored rows absent from the incoming set, which `replace` would have deleted. */
  preservedRowCount: number
}

/**
 * Resolve stored relation rows against the authoritative incoming ones.
 * `replace` makes the stored set equal the incoming one, so empty incoming rows
 * clear the relation; `merge` only adds, so empty incoming rows change nothing.
 */
function buildFinalRelationRows<TType extends string>(
  current: OrderedRelationRow<TType>[],
  incoming: OrderedRelationRow<TType>[],
  collectionMode: IngestUpdatePolicy['collectionUpdate']
): RelationRowPlan<TType> {
  if (collectionMode === 'replace') {
    return {
      rows: incoming.map((row) => ({
        ...row,
        note: normalizeRelationNote(row.note)
      })),
      preservedRowCount: 0
    }
  }

  const incomingKeys = new Set(incoming.map(relationRowKey))
  const preservedRowCount = current.filter((row) => !incomingKeys.has(relationRowKey(row))).length

  if (incoming.length === 0) return { preservedRowCount }

  const merged = current.map((row) => ({
    ...row,
    note: normalizeRelationNote(row.note)
  }))
  const indexByKey = new Map(merged.map((row, index) => [relationRowKey(row), index]))

  for (const row of incoming) {
    const key = relationRowKey(row)
    const existingIndex = indexByKey.get(key)
    if (existingIndex === undefined) {
      indexByKey.set(key, merged.length)
      merged.push({
        ...row,
        note: normalizeRelationNote(row.note)
      })
      continue
    }

    const currentRow = merged[existingIndex]
    merged[existingIndex] = {
      ...currentRow,
      isSpoiler: currentRow.isSpoiler || row.isSpoiler,
      note: normalizeRelationNote(currentRow.note) ?? normalizeRelationNote(row.note)
    }
  }

  return { rows: merged, preservedRowCount }
}

function loadCharacterPersonRows(
  tx: DbContext,
  characterId: string
): OrderedRelationRow<CharacterPersonType>[] {
  return tx
    .select()
    .from(characterPersonLinks)
    .where(eq(characterPersonLinks.characterId, characterId))
    .all()
    .sort((a, b) => a.orderInCharacter - b.orderInCharacter || a.orderInPerson - b.orderInPerson)
    .map((row) => ({
      relatedId: row.personId,
      type: row.type,
      isSpoiler: row.isSpoiler,
      note: normalizeRelationNote(row.note)
    }))
}

function replaceCharacterPersonRows(
  tx: DbContext,
  characterId: string,
  rows: OrderedRelationRow<CharacterPersonType>[]
): void {
  tx.delete(characterPersonLinks).where(eq(characterPersonLinks.characterId, characterId)).run()
  if (rows.length === 0) return

  const personOrderCounters = new Map<string, number>()
  const values: NewCharacterPersonLink[] = rows.map((row, orderInCharacter) => {
    const orderInPerson = personOrderCounters.get(row.relatedId) ?? 0
    personOrderCounters.set(row.relatedId, orderInPerson + 1)

    return {
      characterId,
      personId: row.relatedId,
      type: row.type,
      isSpoiler: row.isSpoiler,
      note: normalizeRelationNote(row.note),
      orderInCharacter,
      orderInPerson
    }
  })

  tx.insert(characterPersonLinks).values(values).run()
}

function loadGamePersonRows(tx: DbContext, gameId: string): OrderedRelationRow<GamePersonType>[] {
  return tx
    .select()
    .from(gamePersonLinks)
    .where(eq(gamePersonLinks.gameId, gameId))
    .all()
    .sort((a, b) => a.orderInGame - b.orderInGame || a.orderInPerson - b.orderInPerson)
    .map((row) => ({
      relatedId: row.personId,
      type: row.type,
      isSpoiler: row.isSpoiler,
      note: normalizeRelationNote(row.note)
    }))
}

function replaceGamePersonRows(
  tx: DbContext,
  gameId: string,
  rows: OrderedRelationRow<GamePersonType>[]
): void {
  tx.delete(gamePersonLinks).where(eq(gamePersonLinks.gameId, gameId)).run()
  if (rows.length === 0) return

  const personOrderCounters = new Map<string, number>()
  const values: NewGamePersonLink[] = rows.map((row, orderInGame) => {
    const orderInPerson = personOrderCounters.get(row.relatedId) ?? 0
    personOrderCounters.set(row.relatedId, orderInPerson + 1)

    return {
      gameId,
      personId: row.relatedId,
      type: row.type,
      isSpoiler: row.isSpoiler,
      note: normalizeRelationNote(row.note),
      orderInGame,
      orderInPerson
    }
  })

  tx.insert(gamePersonLinks).values(values).run()
}

function loadGameCompanyRows(tx: DbContext, gameId: string): OrderedRelationRow<GameCompanyType>[] {
  return tx
    .select()
    .from(gameCompanyLinks)
    .where(eq(gameCompanyLinks.gameId, gameId))
    .all()
    .sort((a, b) => a.orderInGame - b.orderInGame || a.orderInCompany - b.orderInCompany)
    .map((row) => ({
      relatedId: row.companyId,
      type: row.type,
      isSpoiler: row.isSpoiler,
      note: normalizeRelationNote(row.note)
    }))
}

function replaceGameCompanyRows(
  tx: DbContext,
  gameId: string,
  rows: OrderedRelationRow<GameCompanyType>[]
): void {
  tx.delete(gameCompanyLinks).where(eq(gameCompanyLinks.gameId, gameId)).run()
  if (rows.length === 0) return

  const companyOrderCounters = new Map<string, number>()
  const values: NewGameCompanyLink[] = rows.map((row, orderInGame) => {
    const orderInCompany = companyOrderCounters.get(row.relatedId) ?? 0
    companyOrderCounters.set(row.relatedId, orderInCompany + 1)

    return {
      gameId,
      companyId: row.relatedId,
      type: row.type,
      isSpoiler: row.isSpoiler,
      note: normalizeRelationNote(row.note),
      orderInGame,
      orderInCompany
    }
  })

  tx.insert(gameCompanyLinks).values(values).run()
}

function loadGameCharacterRows(
  tx: DbContext,
  gameId: string
): OrderedRelationRow<GameCharacterType>[] {
  return tx
    .select()
    .from(gameCharacterLinks)
    .where(eq(gameCharacterLinks.gameId, gameId))
    .all()
    .sort((a, b) => a.orderInGame - b.orderInGame || a.orderInCharacter - b.orderInCharacter)
    .map((row) => ({
      relatedId: row.characterId,
      type: row.type,
      isSpoiler: row.isSpoiler,
      note: normalizeRelationNote(row.note)
    }))
}

function replaceGameCharacterRows(
  tx: DbContext,
  gameId: string,
  rows: OrderedRelationRow<GameCharacterType>[]
): void {
  tx.delete(gameCharacterLinks).where(eq(gameCharacterLinks.gameId, gameId)).run()
  if (rows.length === 0) return

  const characterOrderCounters = new Map<string, number>()
  const values: NewGameCharacterLink[] = rows.map((row, orderInGame) => {
    const orderInCharacter = characterOrderCounters.get(row.relatedId) ?? 0
    characterOrderCounters.set(row.relatedId, orderInCharacter + 1)

    return {
      gameId,
      characterId: row.relatedId,
      type: row.type,
      isSpoiler: row.isSpoiler,
      note: normalizeRelationNote(row.note),
      orderInGame,
      orderInCharacter
    }
  })

  tx.insert(gameCharacterLinks).values(values).run()
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
  nodes: IngestGameGraph['characters'] | IngestGameCharacterNode[]
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

/** Applies the rows and returns how many stored rows a `replace` would have deleted. */
export function applyCharacterPersonRows(params: {
  tx: DbContext
  characterId: string
  links: ReadonlyArray<IngestCharacterGraph['links'][number]>
  collectionMode: IngestUpdatePolicy['collectionUpdate']
  personIdByIdentity: ReadonlyMap<string, string>
}): number {
  const { tx, characterId, links, collectionMode, personIdByIdentity } = params

  const incomingRows: OrderedRelationRow<CharacterPersonType>[] = links
    .map((link) => {
      const personId = personIdByIdentity.get(link.personIdentityKey)
      if (!personId) return null

      return {
        relatedId: personId,
        type: link.type,
        isSpoiler: link.isSpoiler,
        note: normalizeRelationNote(link.note)
      }
    })
    .filter((row): row is OrderedRelationRow<CharacterPersonType> => row !== null)

  const currentRows = loadCharacterPersonRows(tx, characterId)
  const rowPlan = buildFinalRelationRows(currentRows, incomingRows, collectionMode)
  if (rowPlan.rows && !areRelationRowsEqual(currentRows, rowPlan.rows)) {
    replaceCharacterPersonRows(tx, characterId, rowPlan.rows)
  }

  return rowPlan.preservedRowCount
}

/** Applies the rows and returns how many stored rows a `replace` would have deleted. */
export function applyGamePersonRows(params: {
  tx: DbContext
  gameId: string
  links: ReadonlyArray<IngestGameGraph['links']['gamePerson'][number]>
  collectionMode: IngestUpdatePolicy['collectionUpdate']
  personIdByIdentity: ReadonlyMap<string, string>
}): number {
  const { tx, gameId, links, collectionMode, personIdByIdentity } = params

  const incomingRows: OrderedRelationRow<GamePersonType>[] = links
    .map((link) => {
      const personId = personIdByIdentity.get(link.personIdentityKey)
      if (!personId) return null

      return {
        relatedId: personId,
        type: link.type,
        isSpoiler: link.isSpoiler,
        note: normalizeRelationNote(link.note)
      }
    })
    .filter((row): row is OrderedRelationRow<GamePersonType> => row !== null)

  const currentRows = loadGamePersonRows(tx, gameId)
  const rowPlan = buildFinalRelationRows(currentRows, incomingRows, collectionMode)
  if (rowPlan.rows && !areRelationRowsEqual(currentRows, rowPlan.rows)) {
    replaceGamePersonRows(tx, gameId, rowPlan.rows)
  }

  return rowPlan.preservedRowCount
}

/** Applies the rows and returns how many stored rows a `replace` would have deleted. */
export function applyGameCompanyRows(params: {
  tx: DbContext
  gameId: string
  links: ReadonlyArray<IngestGameGraph['links']['gameCompany'][number]>
  collectionMode: IngestUpdatePolicy['collectionUpdate']
  companyIdByIdentity: ReadonlyMap<string, string>
}): number {
  const { tx, gameId, links, collectionMode, companyIdByIdentity } = params

  const incomingRows: OrderedRelationRow<GameCompanyType>[] = links
    .map((link) => {
      const companyId = companyIdByIdentity.get(link.companyIdentityKey)
      if (!companyId) return null

      return {
        relatedId: companyId,
        type: link.type,
        isSpoiler: link.isSpoiler,
        note: normalizeRelationNote(link.note)
      }
    })
    .filter((row): row is OrderedRelationRow<GameCompanyType> => row !== null)

  const currentRows = loadGameCompanyRows(tx, gameId)
  const rowPlan = buildFinalRelationRows(currentRows, incomingRows, collectionMode)
  if (rowPlan.rows && !areRelationRowsEqual(currentRows, rowPlan.rows)) {
    replaceGameCompanyRows(tx, gameId, rowPlan.rows)
  }

  return rowPlan.preservedRowCount
}

/** Applies the rows and returns how many stored rows a `replace` would have deleted. */
export function applyGameCharacterRows(params: {
  tx: DbContext
  gameId: string
  links: ReadonlyArray<IngestGameGraph['links']['gameCharacter'][number]>
  collectionMode: IngestUpdatePolicy['collectionUpdate']
  characterIdByIdentity: ReadonlyMap<string, string>
}): number {
  const { tx, gameId, links, collectionMode, characterIdByIdentity } = params

  const incomingRows: OrderedRelationRow<GameCharacterType>[] = links
    .map((link) => {
      const characterId = characterIdByIdentity.get(link.characterIdentityKey)
      if (!characterId) return null

      return {
        relatedId: characterId,
        type: link.type,
        isSpoiler: link.isSpoiler,
        note: normalizeRelationNote(link.note)
      }
    })
    .filter((row): row is OrderedRelationRow<GameCharacterType> => row !== null)

  const currentRows = loadGameCharacterRows(tx, gameId)
  const rowPlan = buildFinalRelationRows(currentRows, incomingRows, collectionMode)
  if (rowPlan.rows && !areRelationRowsEqual(currentRows, rowPlan.rows)) {
    replaceGameCharacterRows(tx, gameId, rowPlan.rows)
  }

  return rowPlan.preservedRowCount
}
