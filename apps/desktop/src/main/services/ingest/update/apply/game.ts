import { eq } from 'drizzle-orm'
import {
  gameExternalIdLink,
  requireExternalIdsAvailable,
  resolveTagId,
  type DbContext
} from '@main/services/db'
import { IngestPersistHandlers } from '../../persist'
import type { PendingAssetTask } from '../../assets'
import { gameExternalIds, gameTagLinks, games, type NewGame, type NewGameTagLink } from '@shared/db'
import { normalizeExternalIds, type ExternalId } from '@shared/identity'
import type { GameLinkKind, GameUpdatePlan, UpdateLinkApplyResult } from '../types'
import { applyMediaRelationFacts } from '../../media-relations'
import {
  applyLinkRows,
  filterNodesByIdentity,
  resolveCharacterNodes,
  resolveCompanyNodes,
  resolvePersonNodes
} from './links'

function replaceGameExternalIds(tx: DbContext, gameId: string, externalIds: ExternalId[]): void {
  tx.delete(gameExternalIds).where(eq(gameExternalIds.gameId, gameId)).run()

  const values = normalizeExternalIds(externalIds).map((externalId, index) => ({
    gameId,
    source: externalId.source,
    externalId: externalId.id,
    orderInGame: index
  }))

  if (values.length > 0) {
    tx.insert(gameExternalIds).values(values).run()
  }
}

function replaceGameTags(tx: DbContext, gameId: string, nextTags: GameUpdatePlan['tags']): void {
  tx.delete(gameTagLinks).where(eq(gameTagLinks.gameId, gameId)).run()
  if (!nextTags?.length) return

  const linkValues: NewGameTagLink[] = []
  nextTags.forEach((tag, index) => {
    const tagId = resolveTagId(tx, tag)
    if (!tagId) return

    linkValues.push({
      gameId,
      tagId,
      isSpoiler: tag.isSpoiler ?? false,
      note: tag.note ?? null,
      orderInGame: index,
      orderInTag: 0
    })
  })

  if (linkValues.length > 0) {
    tx.insert(gameTagLinks).values(linkValues).run()
  }
}

function applyGameRelationGraph(
  tx: DbContext,
  gameId: string,
  plan: GameUpdatePlan,
  persistHandlers: IngestPersistHandlers
): UpdateLinkApplyResult<GameLinkKind> {
  const relationGraph = plan.relationGraph
  if (!relationGraph) {
    return { pendingAssets: [], preservedLinkRows: {} }
  }

  const { gamePerson, gameCompany, gameCharacter, characterPerson } = plan.links

  const personIdentityKeys = new Set<string>()
  if (gamePerson) {
    for (const link of relationGraph.links.gamePerson) {
      personIdentityKeys.add(link.personIdentityKey)
    }
  }
  if (characterPerson) {
    for (const link of relationGraph.links.characterPerson) {
      personIdentityKeys.add(link.personIdentityKey)
    }
  }

  const companyIdentityKeys = new Set<string>()
  if (gameCompany) {
    for (const link of relationGraph.links.gameCompany) {
      companyIdentityKeys.add(link.companyIdentityKey)
    }
  }

  const characterIdentityKeys = new Set<string>()
  if (gameCharacter) {
    for (const link of relationGraph.links.gameCharacter) {
      characterIdentityKeys.add(link.characterIdentityKey)
    }
  }
  if (characterPerson) {
    for (const link of relationGraph.links.characterPerson) {
      characterIdentityKeys.add(link.characterIdentityKey)
    }
  }

  const pendingAssets: PendingAssetTask[] = []
  const preservedLinkRows: Partial<Record<GameLinkKind, number>> = {}

  const personResolution =
    personIdentityKeys.size > 0
      ? resolvePersonNodes(
          tx,
          persistHandlers,
          filterNodesByIdentity(relationGraph.persons, personIdentityKeys)
        )
      : { idByIdentity: new Map<string, string>(), pendingAssets: [] }
  pendingAssets.push(...personResolution.pendingAssets)

  const companyResolution =
    companyIdentityKeys.size > 0
      ? resolveCompanyNodes(
          tx,
          persistHandlers,
          filterNodesByIdentity(relationGraph.companies, companyIdentityKeys)
        )
      : { idByIdentity: new Map<string, string>(), pendingAssets: [] }
  pendingAssets.push(...companyResolution.pendingAssets)

  const characterResolution =
    characterIdentityKeys.size > 0
      ? resolveCharacterNodes(
          tx,
          persistHandlers,
          filterNodesByIdentity(relationGraph.characters, characterIdentityKeys)
        )
      : { idByIdentity: new Map<string, string>(), pendingAssets: [] }
  pendingAssets.push(...characterResolution.pendingAssets)

  if (gamePerson) {
    preservedLinkRows.gamePerson = applyLinkRows({
      tx,
      kind: 'gamePerson',
      entityId: gameId,
      links: relationGraph.links.gamePerson,
      relatedIdentityKeyOf: (link) => link.personIdentityKey,
      relatedIdByIdentity: personResolution.idByIdentity,
      collectionMode: gamePerson
    })
  }

  if (gameCompany) {
    preservedLinkRows.gameCompany = applyLinkRows({
      tx,
      kind: 'gameCompany',
      entityId: gameId,
      links: relationGraph.links.gameCompany,
      relatedIdentityKeyOf: (link) => link.companyIdentityKey,
      relatedIdByIdentity: companyResolution.idByIdentity,
      collectionMode: gameCompany
    })
  }

  if (gameCharacter) {
    preservedLinkRows.gameCharacter = applyLinkRows({
      tx,
      kind: 'gameCharacter',
      entityId: gameId,
      links: relationGraph.links.gameCharacter,
      relatedIdentityKeyOf: (link) => link.characterIdentityKey,
      relatedIdByIdentity: characterResolution.idByIdentity,
      collectionMode: gameCharacter
    })
  }

  if (characterPerson) {
    const linksByCharacterId = new Map<string, typeof relationGraph.links.characterPerson>()
    for (const link of relationGraph.links.characterPerson) {
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
        collectionMode: characterPerson
      })
    }
    preservedLinkRows.characterPerson = preserved
  }

  return { pendingAssets, preservedLinkRows }
}

export function applyGamePlan(
  tx: DbContext,
  gameId: string,
  plan: GameUpdatePlan,
  persistHandlers: IngestPersistHandlers
): UpdateLinkApplyResult<GameLinkKind> {
  if (plan.externalIds) {
    requireExternalIdsAvailable(tx, gameExternalIdLink, [gameId], plan.externalIds)
    replaceGameExternalIds(tx, gameId, plan.externalIds)
  }

  if (plan.tags) {
    replaceGameTags(tx, gameId, plan.tags)
  }

  if (Object.keys(plan.patch).length > 0) {
    tx.update(games)
      .set(plan.patch as Partial<NewGame>)
      .where(eq(games.id, gameId))
      .run()
  }

  const plannedMedia: Array<[string, string | undefined]> = [
    ['coverFile', plan.coverUrl],
    ['backdropFile', plan.backdropUrl],
    ['logoFile', plan.logoUrl],
    ['iconFile', plan.iconUrl]
  ]
  const pendingAssets: PendingAssetTask[] = plannedMedia
    .filter(([, url]) => Boolean(url))
    .map(([field, url]) => ({ table: 'games', rowId: gameId, field, url: url as string }))

  const relations = applyGameRelationGraph(tx, gameId, plan, persistHandlers)
  pendingAssets.push(...relations.pendingAssets)

  let unresolvedRelatedEntries: number | undefined
  if (plan.relatedEntries) {
    const relatedResult = applyMediaRelationFacts({
      tx,
      mediaType: 'game',
      entityId: gameId,
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
