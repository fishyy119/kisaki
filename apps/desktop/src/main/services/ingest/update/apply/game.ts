import { eq } from 'drizzle-orm'
import { gameExternalIdLink, requireExternalIdsAvailable, type DbContext } from '@main/services/db'
import { IngestPersistHandlers } from '../../persist'
import type { PendingAssetTask } from '../../assets'
import { gameExternalIds, gameTagLinks, games, type NewGame } from '@shared/db'
import type { GameLinkKind, GameUpdatePlan, UpdateLinkApplyResult } from '../types'
import { applyMediaRelationFacts } from '../../media-relations'
import {
  applyMediaLinkGraph,
  replaceEntityExternalIds,
  replaceEntityTags,
  type ExternalIdRowSpec,
  type TagLinkRowSpec
} from './links'

const GAME_EXTERNAL_ID_SPEC: ExternalIdRowSpec = {
  table: gameExternalIds,
  entityIdColumn: gameExternalIds.gameId,
  entityIdField: 'gameId',
  orderField: 'orderInGame'
}

const GAME_TAG_LINK_SPEC: TagLinkRowSpec = {
  table: gameTagLinks,
  entityIdColumn: gameTagLinks.gameId,
  entityIdField: 'gameId',
  orderInEntityField: 'orderInGame'
}

export function applyGamePlan(
  tx: DbContext,
  gameId: string,
  plan: GameUpdatePlan,
  persistHandlers: IngestPersistHandlers
): UpdateLinkApplyResult<GameLinkKind> {
  if (plan.externalIds) {
    requireExternalIdsAvailable(tx, gameExternalIdLink, [gameId], plan.externalIds)
    replaceEntityExternalIds(tx, GAME_EXTERNAL_ID_SPEC, gameId, plan.externalIds)
  }

  if (plan.tags) {
    replaceEntityTags(tx, GAME_TAG_LINK_SPEC, gameId, plan.tags)
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

  const relationGraph = plan.relationGraph
  const relations = relationGraph
    ? applyMediaLinkGraph({
        tx,
        entityId: gameId,
        persistHandlers,
        nodes: relationGraph,
        person: {
          kind: 'gamePerson',
          mode: plan.links.gamePerson,
          links: relationGraph.links.gamePerson
        },
        company: {
          kind: 'gameCompany',
          mode: plan.links.gameCompany,
          links: relationGraph.links.gameCompany
        },
        character: {
          kind: 'gameCharacter',
          mode: plan.links.gameCharacter,
          links: relationGraph.links.gameCharacter
        },
        cast: {
          kind: 'gameCast',
          mode: plan.links.gameCast,
          links: relationGraph.links.gameCast
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
