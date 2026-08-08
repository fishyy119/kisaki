import { eq } from 'drizzle-orm'
import {
  companyExternalIdLink,
  requireExternalIdsAvailable,
  resolveTagId,
  type DbContext
} from '@main/services/db'
import {
  companies,
  companyExternalIds,
  companyTagLinks,
  type NewCompany,
  type NewCompanyTagLink
} from '@shared/db'
import { normalizeExternalIds, type ExternalId } from '@shared/identity'
import type { CompanyUpdatePlan, UpdateApplyResult } from '../types'

function replaceCompanyExternalIds(
  tx: DbContext,
  companyId: string,
  externalIds: ExternalId[]
): void {
  tx.delete(companyExternalIds).where(eq(companyExternalIds.companyId, companyId)).run()

  const values = normalizeExternalIds(externalIds).map((externalId, index) => ({
    companyId,
    source: externalId.source,
    externalId: externalId.id,
    orderInCompany: index
  }))

  if (values.length > 0) {
    tx.insert(companyExternalIds).values(values).run()
  }
}

function replaceCompanyTags(
  tx: DbContext,
  companyId: string,
  nextTags: CompanyUpdatePlan['tags']
): void {
  tx.delete(companyTagLinks).where(eq(companyTagLinks.companyId, companyId)).run()
  if (!nextTags?.length) return

  const linkValues: NewCompanyTagLink[] = []
  nextTags.forEach((tag, index) => {
    const tagId = resolveTagId(tx, tag)
    if (!tagId) return

    linkValues.push({
      companyId,
      tagId,
      isSpoiler: tag.isSpoiler ?? false,
      note: tag.note ?? null,
      orderInCompany: index,
      orderInTag: 0
    })
  })

  if (linkValues.length > 0) {
    tx.insert(companyTagLinks).values(linkValues).run()
  }
}

export function applyCompanyPlan(
  tx: DbContext,
  companyId: string,
  plan: CompanyUpdatePlan
): UpdateApplyResult {
  if (plan.externalIds) {
    requireExternalIdsAvailable(tx, companyExternalIdLink, [companyId], plan.externalIds)
    replaceCompanyExternalIds(tx, companyId, plan.externalIds)
  }

  if (plan.tags) {
    replaceCompanyTags(tx, companyId, plan.tags)
  }

  if (Object.keys(plan.patch).length > 0) {
    tx.update(companies)
      .set(plan.patch as Partial<NewCompany>)
      .where(eq(companies.id, companyId))
      .run()
  }

  return {
    pendingAssets: plan.logoUrl
      ? [{ table: 'companies', rowId: companyId, field: 'logoFile', url: plan.logoUrl }]
      : []
  }
}
