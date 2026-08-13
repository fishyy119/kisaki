import { eq } from 'drizzle-orm'
import {
  personExternalIdLink,
  requireExternalIdsAvailable,
  type DbContext
} from '@main/services/db'
import { personExternalIds, persons, personTagLinks, type NewPerson } from '@shared/db'
import type { PersonUpdatePlan, UpdateApplyResult } from '../types'
import {
  replaceEntityExternalIds,
  replaceEntityTags,
  type ExternalIdRowSpec,
  type TagLinkRowSpec
} from './links'

const PERSON_EXTERNAL_ID_SPEC: ExternalIdRowSpec = {
  table: personExternalIds,
  entityIdColumn: personExternalIds.personId,
  entityIdField: 'personId',
  orderField: 'orderInPerson'
}

const PERSON_TAG_LINK_SPEC: TagLinkRowSpec = {
  table: personTagLinks,
  entityIdColumn: personTagLinks.personId,
  entityIdField: 'personId',
  orderInEntityField: 'orderInPerson'
}

export function applyPersonPlan(
  tx: DbContext,
  personId: string,
  plan: PersonUpdatePlan
): UpdateApplyResult {
  if (plan.externalIds) {
    requireExternalIdsAvailable(tx, personExternalIdLink, [personId], plan.externalIds)
    replaceEntityExternalIds(tx, PERSON_EXTERNAL_ID_SPEC, personId, plan.externalIds)
  }

  if (plan.tags) {
    replaceEntityTags(tx, PERSON_TAG_LINK_SPEC, personId, plan.tags)
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
