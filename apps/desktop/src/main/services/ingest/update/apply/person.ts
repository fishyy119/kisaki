import { eq, inArray } from 'drizzle-orm'
import type { DbContext } from '@main/services/db'
import {
  personExternalIds,
  persons,
  personTagLinks,
  tags,
  type NewPerson,
  type NewPersonTagLink
} from '@shared/db'
import { normalizeExternalIds, type ExternalId } from '@shared/identity'
import type { PersonUpdatePlan, UpdateApplyResult } from '../types'
import { ensurePersonExternalIdsAvailable, findExistingTagId } from '../utils'

function replacePersonExternalIds(
  tx: DbContext,
  personId: string,
  externalIds: ExternalId[]
): void {
  tx.delete(personExternalIds).where(eq(personExternalIds.personId, personId)).run()

  const values = normalizeExternalIds(externalIds).map((externalId, index) => ({
    personId,
    source: externalId.source,
    externalId: externalId.id,
    orderInPerson: index
  }))

  if (values.length > 0) {
    tx.insert(personExternalIds).values(values).run()
  }
}

function replacePersonTags(
  tx: DbContext,
  personId: string,
  nextTags: PersonUpdatePlan['tags']
): void {
  tx.delete(personTagLinks).where(eq(personTagLinks.personId, personId)).run()
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

  const linkValues: NewPersonTagLink[] = []
  nextTags.forEach((tag, index) => {
    const tagId = existingByName.get(tag.name) ?? findExistingTagId(tx, tag.name)
    if (!tagId) return

    linkValues.push({
      personId,
      tagId,
      isSpoiler: tag.isSpoiler ?? false,
      note: tag.note ?? null,
      orderInPerson: index,
      orderInTag: 0
    })
  })

  if (linkValues.length > 0) {
    tx.insert(personTagLinks).values(linkValues).run()
  }
}

export function applyPersonPlan(
  tx: DbContext,
  personId: string,
  plan: PersonUpdatePlan
): UpdateApplyResult {
  if (plan.externalIds) {
    ensurePersonExternalIdsAvailable(tx, personId, plan.externalIds)
    replacePersonExternalIds(tx, personId, plan.externalIds)
  }

  if (plan.tags) {
    replacePersonTags(tx, personId, plan.tags)
  }

  if (Object.keys(plan.patch).length > 0) {
    tx.update(persons)
      .set(plan.patch as Partial<NewPerson>)
      .where(eq(persons.id, personId))
      .run()
  }

  return {
    pendingAssets: plan.photoUrl ? [{ type: 'person', personId, url: plan.photoUrl }] : []
  }
}
