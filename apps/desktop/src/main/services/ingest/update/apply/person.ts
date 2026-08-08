import { eq } from 'drizzle-orm'
import {
  personExternalIdLink,
  requireExternalIdsAvailable,
  resolveTagId,
  type DbContext
} from '@main/services/db'
import {
  personExternalIds,
  persons,
  personTagLinks,
  type NewPerson,
  type NewPersonTagLink
} from '@shared/db'
import { normalizeExternalIds, type ExternalId } from '@shared/identity'
import type { PersonUpdatePlan, UpdateApplyResult } from '../types'

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
  if (!nextTags?.length) return

  const linkValues: NewPersonTagLink[] = []
  nextTags.forEach((tag, index) => {
    const tagId = resolveTagId(tx, tag)
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
    requireExternalIdsAvailable(tx, personExternalIdLink, [personId], plan.externalIds)
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
    pendingAssets: plan.photoUrl
      ? [{ table: 'persons', rowId: personId, field: 'photoFile', url: plan.photoUrl }]
      : []
  }
}
