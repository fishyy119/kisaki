import { eq } from 'drizzle-orm'
import { companies, companyExternalIds, companyTagLinks, tags } from '@shared/db'
import type { DbContext } from '@main/services/db'
import type { Tag } from '@shared/metadata'
import type { ExternalId } from '@shared/identity'
import type { CompanyCurrentState, UpdateCurrentSelection } from '../types'
import type { CompanyUpdateCoreSurface } from '@shared/ingest/update'

export function loadCompanyCurrent(
  tx: DbContext,
  companyId: string,
  selection: UpdateCurrentSelection<CompanyUpdateCoreSurface>
): CompanyCurrentState {
  const company = tx.select().from(companies).where(eq(companies.id, companyId)).limit(1).all()[0]
  if (!company) {
    throw new Error(`Company not found: ${companyId}`)
  }

  const coreSurfaces = new Set(selection.coreSurfaces)

  const externalIds: ExternalId[] = coreSurfaces.has('externalIds')
    ? tx
        .select()
        .from(companyExternalIds)
        .where(eq(companyExternalIds.companyId, companyId))
        .all()
        .map((row) => ({ source: row.source, id: row.externalId }))
    : []

  const tagsValue: Tag[] = coreSurfaces.has('tags')
    ? tx
        .select()
        .from(companyTagLinks)
        .innerJoin(tags, eq(companyTagLinks.tagId, tags.id))
        .where(eq(companyTagLinks.companyId, companyId))
        .all()
        .map((row) => ({
          name: row.tags.name,
          isNsfw: row.tags.isNsfw,
          isSpoiler: row.company_tag_links.isSpoiler,
          note: row.company_tag_links.note ?? undefined
        }))
    : []

  return {
    company,
    externalIds,
    tags: tagsValue
  }
}
