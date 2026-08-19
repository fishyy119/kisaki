import { resolveTagId, type DbContext, type DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
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
  type NewCollectionGameLink,
  type NewGame,
  type NewGameCharacterLink,
  type NewGameCompanyLink,
  type NewGamePersonLink
} from '@shared/db'
import type {
  IngestGameCharacterLink,
  IngestGameCompanyLink,
  IngestGameGraph,
  IngestGameNode,
  IngestGamePersonLink
} from '../graph'
import { flushPendingAssets, type PendingAssetTask } from '../assets'
import { applyMediaRelationFacts, createUnresolvedRelatedEntriesWarning } from '../media-relations'
import {
  requireOwnerIdentity,
  requirePersistedId,
  resolveCharacterPersonLinks,
  resolveOrderedLinks
} from './links'
import type { PersistGameGraphResult } from './types'
import type { PersonIngestPersistHandler } from './person'
import type { CompanyIngestPersistHandler } from './company'
import type { CharacterIngestPersistHandler } from './character'
import { reportIngestProgress } from '../progress'
import type { IngestOperationOptions } from '../types'

type GamePersistOptions = IngestAddGameFromScraperOptions &
  Pick<IngestOperationOptions, 'signal' | 'onProgress'>

function resolveGamePersonLinks(params: {
  gameId: string
  gameIdentityKey: string
  links: IngestGamePersonLink[]
  personIdByIdentity: Map<string, string>
}): NewGamePersonLink[] {
  const { gameId, gameIdentityKey, links, personIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.gameIdentityKey, gameIdentityKey, 'game')
      const personId = requirePersistedId(personIdByIdentity, link.personIdentityKey, 'person')
      return {
        key: `${personId}:${link.role}`,
        value: {
          personId,
          role: link.role,
          isSpoiler: link.isSpoiler,
          playing: link.playing,
          note: link.note
        }
      }
    },
    buildRow: (link, orderInGame, counters) => ({
      gameId,
      personId: link.personId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      playing: link.playing ?? null,
      note: link.note ?? null,
      orderInGame,
      orderInPerson: counters.next('person', link.personId)
    })
  })
}

function resolveGameCompanyLinks(params: {
  gameId: string
  gameIdentityKey: string
  links: IngestGameCompanyLink[]
  companyIdByIdentity: Map<string, string>
}): NewGameCompanyLink[] {
  const { gameId, gameIdentityKey, links, companyIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.gameIdentityKey, gameIdentityKey, 'game')
      const companyId = requirePersistedId(companyIdByIdentity, link.companyIdentityKey, 'company')
      return {
        key: `${companyId}:${link.role}`,
        value: {
          companyId,
          role: link.role,
          isSpoiler: link.isSpoiler,
          note: link.note
        }
      }
    },
    buildRow: (link, orderInGame, counters) => ({
      gameId,
      companyId: link.companyId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInGame,
      orderInCompany: counters.next('company', link.companyId)
    })
  })
}

function resolveGameCharacterLinks(params: {
  gameId: string
  gameIdentityKey: string
  links: IngestGameCharacterLink[]
  characterIdByIdentity: Map<string, string>
}): NewGameCharacterLink[] {
  const { gameId, gameIdentityKey, links, characterIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.gameIdentityKey, gameIdentityKey, 'game')
      const characterId = requirePersistedId(
        characterIdByIdentity,
        link.characterIdentityKey,
        'character'
      )
      return {
        key: `${characterId}:${link.role}`,
        value: {
          characterId,
          role: link.role,
          isSpoiler: link.isSpoiler,
          note: link.note
        }
      }
    },
    buildRow: (link, orderInGame, counters) => ({
      gameId,
      characterId: link.characterId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInGame,
      orderInCharacter: counters.next('character', link.characterId)
    })
  })
}

export class GameIngestPersistHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly personPersist: PersonIngestPersistHandler,
    private readonly companyPersist: CompanyIngestPersistHandler,
    private readonly characterPersist: CharacterIngestPersistHandler,
    private readonly i18nService: I18nService
  ) {}

  persistGameGraph(
    graph: IngestGameGraph,
    options?: GamePersistOptions
  ): Promise<IngestAddGameFromScraperResult>
  persistGameGraph(
    graph: IngestGameGraph,
    options: GamePersistOptions | undefined,
    tx: DbContext
  ): Promise<PersistGameGraphResult>
  async persistGameGraph(
    graph: IngestGameGraph,
    options?: GamePersistOptions,
    tx?: DbContext
  ): Promise<IngestAddGameFromScraperResult | PersistGameGraphResult> {
    if (tx) {
      return this.persistGameGraphInternal(graph, options, tx)
    }

    const result = this.dbService.client.transaction((trx) =>
      this.persistGameGraphInternal(graph, options, trx)
    )
    if (result.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: this.i18nService.messages.ingest.persist.savingMedia({ entity: 'game' })
      })
    }
    const warnings = await flushPendingAssets(this.dbService, result.pendingAssets, {
      signal: options?.signal
    })
    return this.toPublicResult(result, warnings)
  }

  persistGameGraphInternal(
    graph: IngestGameGraph,
    options: GamePersistOptions | undefined,
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
        throw new Error(`Missing person node for identity: ${identityKey}`)
      }

      const personResult = this.personPersist.persistPersonNodeInternal(personNode, tx)
      personIdByIdentity.set(identityKey, personResult.personId)
      pendingAssets.push(...personResult.pendingAssets)
    }

    const companyIdByIdentity = new Map<string, string>()
    for (const identityKey of requiredCompanyIdentities) {
      const companyNode = companyByIdentity.get(identityKey)
      if (!companyNode) {
        throw new Error(`Missing company node for identity: ${identityKey}`)
      }

      const companyResult = this.companyPersist.persistCompanyNodeInternal(companyNode, tx)
      companyIdByIdentity.set(identityKey, companyResult.companyId)
      pendingAssets.push(...companyResult.pendingAssets)
    }

    const characterIdByIdentity = new Map<string, string>()
    for (const identityKey of requiredCharacterIdentities) {
      const characterNode = characterByIdentity.get(identityKey)
      if (!characterNode) {
        throw new Error(`Missing character node for identity: ${identityKey}`)
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

    const warnings: IngestWarning[] = []
    if (graph.relatedEntries?.length) {
      const related = applyMediaRelationFacts({
        tx,
        mediaType: 'game',
        entityId: gameId,
        facts: graph.relatedEntries,
        collectionMode: 'replace'
      })
      if (related.unresolvedCount > 0) {
        warnings.push(createUnresolvedRelatedEntriesWarning(related.unresolvedCount))
      }
    }

    return {
      gameId,
      isNew: true,
      pendingAssets,
      ...(warnings.length > 0 && { warnings })
    }
  }

  persistGameNodeInternal(
    node: IngestGameNode,
    media: IngestGameGraph['media'],
    tx: DbContext,
    options?: GamePersistOptions
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
      externalSites: gameCore.externalSites || [],
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
    options: GamePersistOptions | undefined,
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
      const tagId = resolveTagId(tx, tagData)
      if (!tagId) {
        continue
      }

      tx.insert(gameTagLinks)
        .values({
          gameId,
          tagId,
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
    const byField: Array<[string, string | undefined]> = [
      ['coverFile', media.coverUrl],
      ['backdropFile', media.backdropUrl],
      ['logoFile', media.logoUrl],
      ['iconFile', media.iconUrl]
    ]

    for (const [field, url] of byField) {
      if (url) {
        pendingAssets.push({ table: 'games', rowId: gameId, field, url })
      }
    }
  }

  private toPublicResult(
    result: PersistGameGraphResult,
    warnings: IngestWarning[]
  ): IngestAddGameFromScraperResult {
    const publicResult: IngestAddGameFromScraperResult = {
      gameId: result.gameId,
      isNew: result.isNew
    }
    if (result.existingReason) {
      publicResult.existingReason = result.existingReason
    }
    const combinedWarnings = [...(result.warnings ?? []), ...warnings]
    if (combinedWarnings.length > 0) {
      publicResult.warnings = combinedWarnings
    }
    return publicResult
  }
}
