import type { DbContext, DbService } from '@main/services/db'
import type {
  IngestAddGameFromScraperOptions,
  IngestAddGameFromScraperResult
} from '@shared/ingest/add'
import type { IngestWarning } from '@shared/ingest'
import { normalizeExternalIds } from '@shared/identity'
import { nanoid } from 'nanoid'
import {
  characterPersonLinks,
  collectionGameLinks,
  gameCharacterLinks,
  gameCompanyLinks,
  gameExternalIds,
  gamePersonLinks,
  games,
  gameTagLinks,
  tags,
  type NewCharacterPersonLink,
  type NewCollectionGameLink,
  type NewGame,
  type NewGameCharacterLink,
  type NewGameCompanyLink,
  type NewGamePersonLink
} from '@shared/db'
import type {
  IngestGameCharacterLink,
  IngestGameCharacterPersonLink,
  IngestGameCompanyLink,
  IngestGameGraph,
  IngestGameNode,
  IngestGamePersonLink
} from '../graph'
import { flushPendingAssets, type PendingAssetTask } from '../assets'
import type { PersistGameGraphResult } from './types'
import type { PersonIngestPersistHandler } from './person'
import type { CompanyIngestPersistHandler } from './company'
import type { CharacterIngestPersistHandler } from './character'

function assertOrderValue(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`[IngestPersist] Invalid ${field}: expected a non-negative integer`)
  }
}

function assertOptionalNote(note: string | undefined): void {
  if (note !== undefined && typeof note !== 'string') {
    throw new Error('[IngestPersist] Invalid note: expected a string when provided')
  }
}

function assertGamePersonLink(link: IngestGamePersonLink): void {
  if (typeof link.isSpoiler !== 'boolean') {
    throw new Error('[IngestPersist] Missing required relation field: isSpoiler')
  }

  assertOrderValue(link.orderInGame, 'orderInGame')
  assertOrderValue(link.orderInPerson, 'orderInPerson')
  assertOptionalNote(link.note)
}

function assertGameCompanyLink(link: IngestGameCompanyLink): void {
  if (typeof link.isSpoiler !== 'boolean') {
    throw new Error('[IngestPersist] Missing required relation field: isSpoiler')
  }

  assertOrderValue(link.orderInGame, 'orderInGame')
  assertOrderValue(link.orderInCompany, 'orderInCompany')
  assertOptionalNote(link.note)
}

function assertGameCharacterLink(link: IngestGameCharacterLink): void {
  if (typeof link.isSpoiler !== 'boolean') {
    throw new Error('[IngestPersist] Missing required relation field: isSpoiler')
  }

  assertOrderValue(link.orderInGame, 'orderInGame')
  assertOrderValue(link.orderInCharacter, 'orderInCharacter')
  assertOptionalNote(link.note)
}

function assertCharacterPersonLink(link: IngestGameCharacterPersonLink): void {
  if (typeof link.isSpoiler !== 'boolean') {
    throw new Error('[IngestPersist] Missing required relation field: isSpoiler')
  }

  assertOrderValue(link.orderInCharacter, 'orderInCharacter')
  assertOrderValue(link.orderInPerson, 'orderInPerson')
  assertOptionalNote(link.note)
}

interface ResolvedRelationState {
  isSpoiler: boolean
  note?: string
}

interface ResolvedGamePersonLink extends ResolvedRelationState {
  personId: string
  type: IngestGamePersonLink['type']
}

interface ResolvedGameCompanyLink extends ResolvedRelationState {
  companyId: string
  type: IngestGameCompanyLink['type']
}

interface ResolvedGameCharacterLink extends ResolvedRelationState {
  characterId: string
  type: IngestGameCharacterLink['type']
}

interface ResolvedCharacterPersonLink extends ResolvedRelationState {
  characterId: string
  personId: string
  type: IngestGameCharacterPersonLink['type']
}

function mergeResolvedRelation<T extends ResolvedRelationState>(
  map: Map<string, T>,
  key: string,
  next: T
): void {
  const existing = map.get(key)
  if (!existing) {
    map.set(key, next)
    return
  }

  existing.isSpoiler = existing.isSpoiler || next.isSpoiler
  existing.note = existing.note ?? next.note
}

function resolveGamePersonLinks(params: {
  gameId: string
  gameIdentityKey: string
  links: IngestGamePersonLink[]
  personIdByIdentity: Map<string, string>
}): NewGamePersonLink[] {
  const { gameId, gameIdentityKey, links, personIdByIdentity } = params
  const resolved = new Map<string, ResolvedGamePersonLink>()

  for (const linkInput of links) {
    assertGamePersonLink(linkInput)

    if (linkInput.gameIdentityKey !== gameIdentityKey) {
      throw new Error(
        `[IngestPersist] Game-person link references unexpected game identity: ${linkInput.gameIdentityKey}`
      )
    }

    const personId = personIdByIdentity.get(linkInput.personIdentityKey)
    if (!personId) {
      throw new Error(
        `[IngestPersist] Missing persisted person for identity: ${linkInput.personIdentityKey}`
      )
    }

    mergeResolvedRelation(resolved, `${personId}:${linkInput.type}`, {
      personId,
      type: linkInput.type,
      isSpoiler: linkInput.isSpoiler,
      note: linkInput.note
    })
  }

  const personOrderCounters = new Map<string, number>()

  return [...resolved.values()].map((link, orderInGame) => {
    const orderInPerson = personOrderCounters.get(link.personId) ?? 0
    personOrderCounters.set(link.personId, orderInPerson + 1)

    return {
      gameId,
      personId: link.personId,
      type: link.type,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInGame,
      orderInPerson
    }
  })
}

function resolveGameCompanyLinks(params: {
  gameId: string
  gameIdentityKey: string
  links: IngestGameCompanyLink[]
  companyIdByIdentity: Map<string, string>
}): NewGameCompanyLink[] {
  const { gameId, gameIdentityKey, links, companyIdByIdentity } = params
  const resolved = new Map<string, ResolvedGameCompanyLink>()

  for (const linkInput of links) {
    assertGameCompanyLink(linkInput)

    if (linkInput.gameIdentityKey !== gameIdentityKey) {
      throw new Error(
        `[IngestPersist] Game-company link references unexpected game identity: ${linkInput.gameIdentityKey}`
      )
    }

    const companyId = companyIdByIdentity.get(linkInput.companyIdentityKey)
    if (!companyId) {
      throw new Error(
        `[IngestPersist] Missing persisted company for identity: ${linkInput.companyIdentityKey}`
      )
    }

    mergeResolvedRelation(resolved, `${companyId}:${linkInput.type}`, {
      companyId,
      type: linkInput.type,
      isSpoiler: linkInput.isSpoiler,
      note: linkInput.note
    })
  }

  const companyOrderCounters = new Map<string, number>()

  return [...resolved.values()].map((link, orderInGame) => {
    const orderInCompany = companyOrderCounters.get(link.companyId) ?? 0
    companyOrderCounters.set(link.companyId, orderInCompany + 1)

    return {
      gameId,
      companyId: link.companyId,
      type: link.type,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInGame,
      orderInCompany
    }
  })
}

function resolveGameCharacterLinks(params: {
  gameId: string
  gameIdentityKey: string
  links: IngestGameCharacterLink[]
  characterIdByIdentity: Map<string, string>
}): NewGameCharacterLink[] {
  const { gameId, gameIdentityKey, links, characterIdByIdentity } = params
  const resolved = new Map<string, ResolvedGameCharacterLink>()

  for (const linkInput of links) {
    assertGameCharacterLink(linkInput)

    if (linkInput.gameIdentityKey !== gameIdentityKey) {
      throw new Error(
        `[IngestPersist] Game-character link references unexpected game identity: ${linkInput.gameIdentityKey}`
      )
    }

    const characterId = characterIdByIdentity.get(linkInput.characterIdentityKey)
    if (!characterId) {
      throw new Error(
        `[IngestPersist] Missing persisted character for identity: ${linkInput.characterIdentityKey}`
      )
    }

    mergeResolvedRelation(resolved, `${characterId}:${linkInput.type}`, {
      characterId,
      type: linkInput.type,
      isSpoiler: linkInput.isSpoiler,
      note: linkInput.note
    })
  }

  const characterOrderCounters = new Map<string, number>()

  return [...resolved.values()].map((link, orderInGame) => {
    const orderInCharacter = characterOrderCounters.get(link.characterId) ?? 0
    characterOrderCounters.set(link.characterId, orderInCharacter + 1)

    return {
      gameId,
      characterId: link.characterId,
      type: link.type,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInGame,
      orderInCharacter
    }
  })
}

function resolveCharacterPersonLinks(params: {
  links: IngestGameCharacterPersonLink[]
  characterIdByIdentity: Map<string, string>
  personIdByIdentity: Map<string, string>
}): NewCharacterPersonLink[] {
  const { links, characterIdByIdentity, personIdByIdentity } = params
  const resolved = new Map<string, ResolvedCharacterPersonLink>()

  for (const linkInput of links) {
    assertCharacterPersonLink(linkInput)

    const characterId = characterIdByIdentity.get(linkInput.characterIdentityKey)
    if (!characterId) {
      throw new Error(
        `[IngestPersist] Missing persisted character for identity: ${linkInput.characterIdentityKey}`
      )
    }

    const personId = personIdByIdentity.get(linkInput.personIdentityKey)
    if (!personId) {
      throw new Error(
        `[IngestPersist] Missing persisted person for identity: ${linkInput.personIdentityKey}`
      )
    }

    mergeResolvedRelation(resolved, `${characterId}:${personId}:${linkInput.type}`, {
      characterId,
      personId,
      type: linkInput.type,
      isSpoiler: linkInput.isSpoiler,
      note: linkInput.note
    })
  }

  const characterOrderCounters = new Map<string, number>()
  const personOrderCounters = new Map<string, number>()

  return [...resolved.values()].map((link) => {
    const orderInCharacter = characterOrderCounters.get(link.characterId) ?? 0
    characterOrderCounters.set(link.characterId, orderInCharacter + 1)

    const orderInPerson = personOrderCounters.get(link.personId) ?? 0
    personOrderCounters.set(link.personId, orderInPerson + 1)

    return {
      characterId: link.characterId,
      personId: link.personId,
      type: link.type,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInCharacter,
      orderInPerson
    }
  })
}

export class GameIngestPersistHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly personPersist: PersonIngestPersistHandler,
    private readonly companyPersist: CompanyIngestPersistHandler,
    private readonly characterPersist: CharacterIngestPersistHandler
  ) {}

  persistGameGraph(
    graph: IngestGameGraph,
    options?: IngestAddGameFromScraperOptions
  ): Promise<IngestAddGameFromScraperResult>
  persistGameGraph(
    graph: IngestGameGraph,
    options: IngestAddGameFromScraperOptions | undefined,
    tx: DbContext
  ): Promise<PersistGameGraphResult>
  async persistGameGraph(
    graph: IngestGameGraph,
    options?: IngestAddGameFromScraperOptions,
    tx?: DbContext
  ): Promise<IngestAddGameFromScraperResult | PersistGameGraphResult> {
    if (tx) {
      return this.persistGameGraphInternal(graph, options, tx)
    }

    const result = this.dbService.client.transaction((trx) =>
      this.persistGameGraphInternal(graph, options, trx)
    )
    const warnings = await flushPendingAssets(this.dbService, result.pendingAssets)
    return this.toPublicResult(result, warnings)
  }

  persistGameGraphInternal(
    graph: IngestGameGraph,
    options: IngestAddGameFromScraperOptions | undefined,
    tx: DbContext
  ): PersistGameGraphResult {
    const gameResult = this.persistGameNodeInternal(graph.game, graph.media, tx, options)
    if (!gameResult.isNew) {
      return gameResult
    }

    const gameId = gameResult.gameId
    const pendingAssets: PendingAssetTask[] = [...gameResult.pendingAssets]

    const personByIdentity = new Map(graph.persons.map((node) => [node.identityKey, node]))
    const companyByIdentity = new Map(graph.companies.map((node) => [node.identityKey, node]))
    const characterByIdentity = new Map(graph.characters.map((node) => [node.identityKey, node]))

    const requiredPersonIdentities = new Set<string>()
    for (const link of graph.links.gamePerson) {
      requiredPersonIdentities.add(link.personIdentityKey)
    }
    for (const link of graph.links.characterPerson) {
      requiredPersonIdentities.add(link.personIdentityKey)
    }

    const requiredCompanyIdentities = new Set<string>()
    for (const link of graph.links.gameCompany) {
      requiredCompanyIdentities.add(link.companyIdentityKey)
    }

    const requiredCharacterIdentities = new Set<string>()
    for (const link of graph.links.gameCharacter) {
      requiredCharacterIdentities.add(link.characterIdentityKey)
    }
    for (const link of graph.links.characterPerson) {
      requiredCharacterIdentities.add(link.characterIdentityKey)
    }

    const personIdByIdentity = new Map<string, string>()
    for (const identityKey of requiredPersonIdentities) {
      const personNode = personByIdentity.get(identityKey)
      if (!personNode) {
        throw new Error(`[IngestPersist] Missing person node for identity: ${identityKey}`)
      }

      const personResult = this.personPersist.persistPersonNodeInternal(personNode, tx)
      personIdByIdentity.set(identityKey, personResult.personId)
      pendingAssets.push(...personResult.pendingAssets)
    }

    const companyIdByIdentity = new Map<string, string>()
    for (const identityKey of requiredCompanyIdentities) {
      const companyNode = companyByIdentity.get(identityKey)
      if (!companyNode) {
        throw new Error(`[IngestPersist] Missing company node for identity: ${identityKey}`)
      }

      const companyResult = this.companyPersist.persistCompanyNodeInternal(companyNode, tx)
      companyIdByIdentity.set(identityKey, companyResult.companyId)
      pendingAssets.push(...companyResult.pendingAssets)
    }

    const characterIdByIdentity = new Map<string, string>()
    for (const identityKey of requiredCharacterIdentities) {
      const characterNode = characterByIdentity.get(identityKey)
      if (!characterNode) {
        throw new Error(`[IngestPersist] Missing character node for identity: ${identityKey}`)
      }

      const characterResult = this.characterPersist.persistCharacterNodeInternal(characterNode, tx)
      characterIdByIdentity.set(identityKey, characterResult.characterId)
      pendingAssets.push(...characterResult.pendingAssets)
    }

    const resolvedGamePersonLinks = resolveGamePersonLinks({
      gameId,
      gameIdentityKey: graph.game.identityKey,
      links: graph.links.gamePerson,
      personIdByIdentity
    })
    for (const link of resolvedGamePersonLinks) {
      tx.insert(gamePersonLinks).values(link).run()
    }

    const resolvedGameCompanyLinks = resolveGameCompanyLinks({
      gameId,
      gameIdentityKey: graph.game.identityKey,
      links: graph.links.gameCompany,
      companyIdByIdentity
    })
    for (const link of resolvedGameCompanyLinks) {
      tx.insert(gameCompanyLinks).values(link).run()
    }

    const resolvedGameCharacterLinks = resolveGameCharacterLinks({
      gameId,
      gameIdentityKey: graph.game.identityKey,
      links: graph.links.gameCharacter,
      characterIdByIdentity
    })
    for (const link of resolvedGameCharacterLinks) {
      tx.insert(gameCharacterLinks).values(link).run()
    }

    const resolvedCharacterPersonLinks = resolveCharacterPersonLinks({
      links: graph.links.characterPerson,
      characterIdByIdentity,
      personIdByIdentity
    })
    for (const link of resolvedCharacterPersonLinks) {
      tx.insert(characterPersonLinks).values(link).onConflictDoNothing().run()
    }

    return {
      gameId,
      isNew: true,
      pendingAssets
    }
  }

  persistGameNodeInternal(
    node: IngestGameNode,
    media: IngestGameGraph['media'],
    tx: DbContext,
    options?: IngestAddGameFromScraperOptions
  ): PersistGameGraphResult {
    const existing = this.findExistingGame(node, options, tx)
    if (existing) {
      this.addToCollection(tx, existing.gameId, options?.targetCollectionId)
      return {
        gameId: existing.gameId,
        isNew: false,
        existingReason: existing.existingReason,
        pendingAssets: []
      }
    }

    const gameCore = node.core
    const gameId = nanoid()
    const newGame: NewGame = {
      id: gameId,
      name: gameCore.name,
      originalName: gameCore.originalName,
      releaseDate: gameCore.releaseDate,
      description: gameCore.description,
      relatedSites: gameCore.relatedSites || [],
      gameDirPath: options?.gameDirPath,
      launcherPath: options?.gameFilePath
    }

    tx.insert(games).values(newGame).run()
    this.insertExternalIds(tx, gameId, gameCore.externalIds)
    this.insertTagLinks(tx, gameId, gameCore.tags)

    const pendingAssets: PendingAssetTask[] = []
    this.collectGameAssets(pendingAssets, gameId, media)
    this.addToCollection(tx, gameId, options?.targetCollectionId)

    return {
      gameId,
      isNew: true,
      pendingAssets
    }
  }

  private findExistingGame(
    node: IngestGameNode,
    options: IngestAddGameFromScraperOptions | undefined,
    tx: DbContext
  ): { gameId: string; existingReason: 'path' | 'externalId' } | undefined {
    if (options?.gameDirPath) {
      const existingByPath = this.dbService.entityFinder.findExistingGame(
        { path: options.gameDirPath },
        tx
      )
      if (existingByPath) {
        return { gameId: existingByPath.id, existingReason: 'path' }
      }
    }

    const externalIds = node.core.externalIds
    if (externalIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExistingGame({ externalIds }, tx)
      if (existingByExternalId) {
        return { gameId: existingByExternalId.id, existingReason: 'externalId' }
      }
    }

    return undefined
  }

  private insertExternalIds(
    tx: DbContext,
    gameId: string,
    externalIds?: Array<{ source: string; id: string }>
  ): void {
    if (!externalIds?.length) return

    for (const [index, extId] of normalizeExternalIds(externalIds).entries()) {
      tx.insert(gameExternalIds)
        .values({
          gameId,
          source: extId.source,
          externalId: extId.id,
          orderInGame: index
        })
        .onConflictDoNothing()
        .run()
    }
  }

  private insertTagLinks(
    tx: DbContext,
    gameId: string,
    metadataTags?: Array<{ name: string; isNsfw?: boolean; isSpoiler?: boolean; note?: string }>
  ): void {
    if (!metadataTags?.length) return

    for (let i = 0; i < metadataTags.length; i++) {
      const tagData = metadataTags[i]
      tx.insert(tags)
        .values({ name: tagData.name, isNsfw: tagData.isNsfw })
        .onConflictDoNothing()
        .run()

      const existingTag = this.dbService.entityFinder.findExistingTag({ name: tagData.name }, tx)
      if (!existingTag) {
        continue
      }

      tx.insert(gameTagLinks)
        .values({
          gameId,
          tagId: existingTag.id,
          isSpoiler: tagData.isSpoiler || false,
          note: tagData.note || null,
          orderInGame: i,
          orderInTag: 0
        })
        .run()
    }
  }

  private addToCollection(tx: DbContext, gameId: string, targetCollectionId?: string): void {
    if (!targetCollectionId) return

    const collectionLink: NewCollectionGameLink = {
      id: nanoid(),
      collectionId: targetCollectionId,
      gameId,
      orderInCollection: 0
    }

    tx.insert(collectionGameLinks).values(collectionLink).onConflictDoNothing().run()
  }

  private collectGameAssets(
    pendingAssets: PendingAssetTask[],
    gameId: string,
    media: IngestGameGraph['media']
  ): void {
    if (media.coverUrl) {
      pendingAssets.push({ type: 'game', gameId, field: 'coverFile', url: media.coverUrl })
    }

    if (media.backdropUrl) {
      pendingAssets.push({
        type: 'game',
        gameId,
        field: 'backdropFile',
        url: media.backdropUrl
      })
    }

    if (media.logoUrl) {
      pendingAssets.push({ type: 'game', gameId, field: 'logoFile', url: media.logoUrl })
    }

    if (media.iconUrl) {
      pendingAssets.push({ type: 'game', gameId, field: 'iconFile', url: media.iconUrl })
    }
  }

  private toPublicResult(
    result: PersistGameGraphResult,
    warnings: IngestWarning[]
  ): IngestAddGameFromScraperResult {
    const { pendingAssets, ...publicResult } = result
    void pendingAssets
    return warnings.length > 0 ? { ...publicResult, warnings } : publicResult
  }
}
