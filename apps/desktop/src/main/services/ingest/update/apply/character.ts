import { eq, inArray } from 'drizzle-orm'
import type { DbContext } from '@main/services/db'
import { IngestPersistHandlers } from '../../persist'
import type { PendingAssetTask } from '../../assets'
import {
  characterExternalIds,
  characterTagLinks,
  characters,
  tags,
  type NewCharacter,
  type NewCharacterTagLink
} from '@shared/db'
import { normalizeExternalIds, type ExternalId } from '@shared/identity'
import type { CharacterUpdatePlan, UpdateApplyResult } from '../types'
import { ensureCharacterExternalIdsAvailable, findExistingTagId } from '../shared/availability'
import { applyCharacterPersonRows, filterNodesByIdentity, resolvePersonNodes } from './relations'

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

  const linkValues: NewCharacterTagLink[] = []
  nextTags.forEach((tag, index) => {
    const tagId = existingByName.get(tag.name) ?? findExistingTagId(tx, tag.name)
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
): PendingAssetTask[] {
  const relationGraph = plan.relationGraph
  if (!relationGraph || !plan.selectedRelationSurfaces.includes('person')) {
    return []
  }

  const personIdentityKeys = new Set(relationGraph.links.map((link) => link.personIdentityKey))
  const { idByIdentity, pendingAssets } = resolvePersonNodes(
    tx,
    persistHandlers,
    filterNodesByIdentity(relationGraph.persons, personIdentityKeys)
  )

  applyCharacterPersonRows({
    tx,
    characterId,
    links: relationGraph.links,
    collectionMode: plan.collectionMode,
    personIdByIdentity: idByIdentity
  })

  return pendingAssets
}

export function applyCharacterPlan(
  tx: DbContext,
  characterId: string,
  plan: CharacterUpdatePlan,
  persistHandlers: IngestPersistHandlers
): UpdateApplyResult {
  if (plan.externalIds) {
    ensureCharacterExternalIdsAvailable(tx, characterId, plan.externalIds)
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
    ? [{ type: 'character', characterId, url: plan.photoUrl }]
    : []

  pendingAssets.push(...applyCharacterRelationGraph(tx, characterId, plan, persistHandlers))

  return { pendingAssets }
}
