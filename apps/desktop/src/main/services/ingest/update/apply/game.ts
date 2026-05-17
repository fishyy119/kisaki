import { eq, inArray } from 'drizzle-orm'
import type { DbContext } from '@main/services/db'
import { IngestPersistHandlers } from '../../persist'
import type { PendingAssetTask } from '../../assets'
import {
  gameExternalIds,
  gameTagLinks,
  games,
  tags,
  type NewGame,
  type NewGameTagLink
} from '@shared/db'
import { normalizeExternalIds, type ExternalId } from '@shared/identity'
import type { GameUpdatePlan, UpdateApplyResult } from '../types'
import { ensureGameExternalIdsAvailable, findExistingTagId } from '../shared/availability'
import {
  applyCharacterPersonRows,
  applyGameCharacterRows,
  applyGameCompanyRows,
  applyGamePersonRows,
  filterNodesByIdentity,
  resolveCharacterNodes,
  resolveCompanyNodes,
  resolvePersonNodes
} from './relations'

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
  if (!nextTags || nextTags.length === 0) return

  const tagNames = [...new Set(nextTags.map((tag) => tag.name))]
  const existingRows = tx.select().from(tags).where(inArray(tags.name, tagNames)).all()
  const existingByName = new Map(existingRows.map((row) => [row.name, row.id]))

  for (const tag of nextTags) {
    if (existingByName.has(tag.name)) continue
    tx.insert(tags)
      .values({ name: tag.name, isNsfw: tag.isNsfw ?? false })
      .onConflictDoNothing()
      .run()
  }

  const linkValues: NewGameTagLink[] = []
  nextTags.forEach((tag, index) => {
    const tagId = existingByName.get(tag.name) ?? findExistingTagId(tx, tag.name)
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
): PendingAssetTask[] {
  const relationGraph = plan.relationGraph
  if (!relationGraph) {
    return []
  }

  const selected = new Set(plan.selectedRelationSurfaces)

  const personIdentityKeys = new Set<string>()
  if (selected.has('person')) {
    for (const link of relationGraph.links.gamePerson) {
      personIdentityKeys.add(link.personIdentityKey)
    }
  }
  if (selected.has('character')) {
    for (const link of relationGraph.links.characterPerson) {
      personIdentityKeys.add(link.personIdentityKey)
    }
  }

  const companyIdentityKeys = new Set<string>()
  if (selected.has('company')) {
    for (const link of relationGraph.links.gameCompany) {
      companyIdentityKeys.add(link.companyIdentityKey)
    }
  }

  const characterIdentityKeys = new Set<string>()
  if (selected.has('character')) {
    for (const link of relationGraph.links.gameCharacter) {
      characterIdentityKeys.add(link.characterIdentityKey)
    }
    for (const link of relationGraph.links.characterPerson) {
      characterIdentityKeys.add(link.characterIdentityKey)
    }
  }

  const pendingAssets: PendingAssetTask[] = []

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

  if (selected.has('person')) {
    applyGamePersonRows({
      tx,
      gameId,
      links: relationGraph.links.gamePerson,
      collectionMode: plan.collectionMode,
      personIdByIdentity: personResolution.idByIdentity
    })
  }

  if (selected.has('company')) {
    applyGameCompanyRows({
      tx,
      gameId,
      links: relationGraph.links.gameCompany,
      collectionMode: plan.collectionMode,
      companyIdByIdentity: companyResolution.idByIdentity
    })
  }

  if (selected.has('character')) {
    applyGameCharacterRows({
      tx,
      gameId,
      links: relationGraph.links.gameCharacter,
      collectionMode: plan.collectionMode,
      characterIdByIdentity: characterResolution.idByIdentity
    })

    const linksByCharacterId = new Map<string, typeof relationGraph.links.characterPerson>()
    for (const link of relationGraph.links.characterPerson) {
      const characterId = characterResolution.idByIdentity.get(link.characterIdentityKey)
      if (!characterId) continue

      const links = linksByCharacterId.get(characterId) ?? []
      links.push(link)
      linksByCharacterId.set(characterId, links)
    }

    for (const [characterId, links] of linksByCharacterId) {
      applyCharacterPersonRows({
        tx,
        characterId,
        links,
        collectionMode: plan.collectionMode,
        personIdByIdentity: personResolution.idByIdentity
      })
    }
  }

  return pendingAssets
}

export function applyGamePlan(
  tx: DbContext,
  gameId: string,
  plan: GameUpdatePlan,
  persistHandlers: IngestPersistHandlers
): UpdateApplyResult {
  if (plan.externalIds) {
    ensureGameExternalIdsAvailable(tx, gameId, plan.externalIds)
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

  const pendingAssets: PendingAssetTask[] = [
    ...(plan.coverUrl
      ? [{ type: 'game' as const, gameId, field: 'coverFile' as const, url: plan.coverUrl }]
      : []),
    ...(plan.backdropUrl
      ? [{ type: 'game' as const, gameId, field: 'backdropFile' as const, url: plan.backdropUrl }]
      : []),
    ...(plan.logoUrl
      ? [{ type: 'game' as const, gameId, field: 'logoFile' as const, url: plan.logoUrl }]
      : []),
    ...(plan.iconUrl
      ? [{ type: 'game' as const, gameId, field: 'iconFile' as const, url: plan.iconUrl }]
      : [])
  ]

  pendingAssets.push(...applyGameRelationGraph(tx, gameId, plan, persistHandlers))

  return { pendingAssets }
}
