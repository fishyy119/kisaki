import { eq } from 'drizzle-orm'
import {
  characterExternalIdLink,
  requireExternalIdsAvailable,
  type DbContext
} from '@main/services/db'
import { IngestPersistHandlers } from '../../persist'
import type { PendingAssetTask } from '../../assets'
import { characterExternalIds, characterTagLinks, characters, type NewCharacter } from '@shared/db'
import type { CharacterLinkKind, CharacterUpdatePlan } from './types'
import type { UpdateLinkApplyResult } from '../types'
import {
  applyLinkRows,
  filterNodesByIdentity,
  replaceEntityExternalIds,
  replaceEntityTags,
  resolvePersonNodes,
  type ExternalIdRowSpec,
  type TagLinkRowSpec
} from '../shared/links'

const CHARACTER_EXTERNAL_ID_SPEC: ExternalIdRowSpec = {
  table: characterExternalIds,
  entityIdColumn: characterExternalIds.characterId,
  entityIdField: 'characterId',
  orderField: 'orderInCharacter'
}

const CHARACTER_TAG_LINK_SPEC: TagLinkRowSpec = {
  table: characterTagLinks,
  entityIdColumn: characterTagLinks.characterId,
  entityIdField: 'characterId',
  orderInEntityField: 'orderInCharacter'
}

function applyCharacterRelationGraph(
  tx: DbContext,
  characterId: string,
  plan: CharacterUpdatePlan,
  persistHandlers: IngestPersistHandlers
): UpdateLinkApplyResult<CharacterLinkKind> {
  const relationGraph = plan.relationGraph
  const collectionMode = plan.links.characterPerson
  if (!relationGraph || !collectionMode) {
    return { pendingAssets: [], preservedLinkRows: {} }
  }

  const personIdentityKeys = new Set(relationGraph.links.map((link) => link.personIdentityKey))
  const { idByIdentity, pendingAssets } = resolvePersonNodes(
    tx,
    persistHandlers,
    filterNodesByIdentity(relationGraph.persons, personIdentityKeys)
  )

  const preserved = applyLinkRows({
    tx,
    kind: 'characterPerson',
    entityId: characterId,
    links: relationGraph.links,
    relatedIdentityKeyOf: (link) => link.personIdentityKey,
    relatedIdByIdentity: idByIdentity,
    collectionMode
  })

  return { pendingAssets, preservedLinkRows: { characterPerson: preserved } }
}

export function applyCharacterPlan(
  tx: DbContext,
  characterId: string,
  plan: CharacterUpdatePlan,
  persistHandlers: IngestPersistHandlers
): UpdateLinkApplyResult<CharacterLinkKind> {
  if (plan.externalIds) {
    requireExternalIdsAvailable(tx, characterExternalIdLink, [characterId], plan.externalIds)
    replaceEntityExternalIds(tx, CHARACTER_EXTERNAL_ID_SPEC, characterId, plan.externalIds)
  }

  if (plan.tags) {
    replaceEntityTags(tx, CHARACTER_TAG_LINK_SPEC, characterId, plan.tags)
  }

  if (Object.keys(plan.patch).length > 0) {
    tx.update(characters)
      .set(plan.patch as Partial<NewCharacter>)
      .where(eq(characters.id, characterId))
      .run()
  }

  const pendingAssets: PendingAssetTask[] = plan.photoUrl
    ? [{ table: 'characters', rowId: characterId, field: 'photoFile', url: plan.photoUrl }]
    : []

  const relations = applyCharacterRelationGraph(tx, characterId, plan, persistHandlers)
  pendingAssets.push(...relations.pendingAssets)

  return { pendingAssets, preservedLinkRows: relations.preservedLinkRows }
}
