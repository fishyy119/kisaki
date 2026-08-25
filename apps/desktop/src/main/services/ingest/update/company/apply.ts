import { eq } from 'drizzle-orm'
import {
  companyExternalIdLink,
  requireExternalIdsAvailable,
  type DbContext
} from '@main/services/db'
import { companies, companyExternalIds, companyTagLinks, type NewCompany } from '@shared/db'
import type { CompanyUpdatePlan } from './types'
import type { UpdateApplyResult } from '../types'
import {
  replaceEntityExternalIds,
  replaceEntityTags,
  type ExternalIdRowSpec,
  type TagLinkRowSpec
} from '../shared/links'

const COMPANY_EXTERNAL_ID_SPEC: ExternalIdRowSpec = {
  table: companyExternalIds,
  entityIdColumn: companyExternalIds.companyId,
  entityIdField: 'companyId',
  orderField: 'orderInCompany'
}

const COMPANY_TAG_LINK_SPEC: TagLinkRowSpec = {
  table: companyTagLinks,
  entityIdColumn: companyTagLinks.companyId,
  entityIdField: 'companyId',
  orderInEntityField: 'orderInCompany'
}

export function applyCompanyPlan(
  tx: DbContext,
  companyId: string,
  plan: CompanyUpdatePlan
): UpdateApplyResult {
  if (plan.externalIds) {
    requireExternalIdsAvailable(tx, companyExternalIdLink, [companyId], plan.externalIds)
    replaceEntityExternalIds(tx, COMPANY_EXTERNAL_ID_SPEC, companyId, plan.externalIds)
  }

  if (plan.tags) {
    replaceEntityTags(tx, COMPANY_TAG_LINK_SPEC, companyId, plan.tags)
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
