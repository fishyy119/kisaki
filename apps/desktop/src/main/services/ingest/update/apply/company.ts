import { eq, inArray } from 'drizzle-orm'
import type { DbContext } from '@main/services/db'
import {
  companies,
  companyExternalIds,
  companyTagLinks,
  tags,
  type NewCompany,
  type NewCompanyTagLink
} from '@shared/db'
import { normalizeExternalIds, type ExternalId } from '@shared/identity'
import type { CompanyUpdatePlan, UpdateApplyResult } from '../types'
import { ensureCompanyExternalIdsAvailable, findExistingTagId } from '../utils'

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

  const linkValues: NewCompanyTagLink[] = []
  nextTags.forEach((tag, index) => {
    const tagId = existingByName.get(tag.name) ?? findExistingTagId(tx, tag.name)
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
    ensureCompanyExternalIdsAvailable(tx, companyId, plan.externalIds)
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
    pendingAssets: plan.logoUrl ? [{ type: 'company', companyId, url: plan.logoUrl }] : []
  }
}
