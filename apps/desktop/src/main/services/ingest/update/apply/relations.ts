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

function buildFinalRelationRows<TType extends string>(
  current: OrderedRelationRow<TType>[],
  incoming: OrderedRelationRow<TType>[],
  collectionMode: IngestUpdatePolicy['collectionUpdate']
): OrderedRelationRow<TType>[] | undefined {
  if (incoming.length === 0) return undefined

  if (collectionMode === 'replace') {
    return incoming.map((row) => ({
      ...row,
      note: normalizeRelationNote(row.note)
    }))
  }

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

  return merged
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

export function applyCharacterPersonRows(params: {
  tx: DbContext
  characterId: string
  links: ReadonlyArray<IngestCharacterGraph['links'][number]>
  collectionMode: IngestUpdatePolicy['collectionUpdate']
  personIdByIdentity: ReadonlyMap<string, string>
}): void {
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
  const nextRows = buildFinalRelationRows(currentRows, incomingRows, collectionMode)
  if (!nextRows || areRelationRowsEqual(currentRows, nextRows)) {
    return
  }

  replaceCharacterPersonRows(tx, characterId, nextRows)
}

export function applyGamePersonRows(params: {
  tx: DbContext
  gameId: string
  links: ReadonlyArray<IngestGameGraph['links']['gamePerson'][number]>
  collectionMode: IngestUpdatePolicy['collectionUpdate']
  personIdByIdentity: ReadonlyMap<string, string>
}): void {
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
  const nextRows = buildFinalRelationRows(currentRows, incomingRows, collectionMode)
  if (!nextRows || areRelationRowsEqual(currentRows, nextRows)) {
    return
  }

  replaceGamePersonRows(tx, gameId, nextRows)
}

export function applyGameCompanyRows(params: {
  tx: DbContext
  gameId: string
  links: ReadonlyArray<IngestGameGraph['links']['gameCompany'][number]>
  collectionMode: IngestUpdatePolicy['collectionUpdate']
  companyIdByIdentity: ReadonlyMap<string, string>
}): void {
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
  const nextRows = buildFinalRelationRows(currentRows, incomingRows, collectionMode)
  if (!nextRows || areRelationRowsEqual(currentRows, nextRows)) {
    return
  }

  replaceGameCompanyRows(tx, gameId, nextRows)
}

export function applyGameCharacterRows(params: {
  tx: DbContext
  gameId: string
  links: ReadonlyArray<IngestGameGraph['links']['gameCharacter'][number]>
  collectionMode: IngestUpdatePolicy['collectionUpdate']
  characterIdByIdentity: ReadonlyMap<string, string>
}): void {
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
  const nextRows = buildFinalRelationRows(currentRows, incomingRows, collectionMode)
  if (!nextRows || areRelationRowsEqual(currentRows, nextRows)) {
    return
  }

  replaceGameCharacterRows(tx, gameId, nextRows)
}
