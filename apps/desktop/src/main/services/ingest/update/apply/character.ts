import { eq } from 'drizzle-orm'
import {
  characterExternalIdLink,
  requireExternalIdsAvailable,
  resolveTagId,
  type DbContext
} from '@main/services/db'
import { IngestPersistHandlers } from '../../persist'
import type { PendingAssetTask } from '../../assets'
import {
  characterExternalIds,
  characterTagLinks,
  characters,
  type NewCharacter,
  type NewCharacterTagLink
} from '@shared/db'
import { normalizeExternalIds, type ExternalId } from '@shared/identity'
import type { CharacterLinkKind, CharacterUpdatePlan, UpdateLinkApplyResult } from '../types'
import { applyLinkRows, filterNodesByIdentity, resolvePersonNodes } from './links'

function replaceCharacterExternalIds(
  tx: DbContext,
  characterId: string,
  externalIds: ExternalId[]
): void {
  tx.delete(characterExternalIds).where(eq(characterExternalIds.characterId, characterId)).run()

  const values = normalizeExternalIds(externalIds).map((externalId, index) => ({
    characterId,
    source: externalId.source,
    externalId: externalId.id,
    orderInCharacter: index
  }))

  if (values.length > 0) {
    tx.insert(characterExternalIds).values(values).run()
  }
}

function replaceCharacterTags(
  tx: DbContext,
  characterId: string,
  nextTags: CharacterUpdatePlan['tags']
): void {
  tx.delete(characterTagLinks).where(eq(characterTagLinks.characterId, characterId)).run()
  if (!nextTags?.length) return

  const linkValues: NewCharacterTagLink[] = []
  nextTags.forEach((tag, index) => {
    const tagId = resolveTagId(tx, tag)
    if (!tagId) return

    linkValues.push({
      characterId,
      tagId,
      isSpoiler: tag.isSpoiler ?? false,
      note: tag.note ?? null,
      orderInCharacter: index,
      orderInTag: 0
    })
  })

  if (linkValues.length > 0) {
    tx.insert(characterTagLinks).values(linkValues).run()
  }
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
    replaceCharacterExternalIds(tx, characterId, plan.externalIds)
  }

  if (plan.tags) {
    replaceCharacterTags(tx, characterId, plan.tags)
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
