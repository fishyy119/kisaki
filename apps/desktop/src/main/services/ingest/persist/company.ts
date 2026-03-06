import type { DbContext, DbService } from '@main/services/db'
import type {
  IngestAddCompanyFromScraperOptions,
  IngestAddCompanyFromScraperResult,
  IngestWarning,
  IngestCompanyGraph,
  IngestCompanyNode
} from '@shared/ingest'
import { normalizeExternalIds } from '@shared/identity'
import { nanoid } from 'nanoid'
import {
  collectionCompanyLinks,
  companies,
  companyExternalIds,
  companyTagLinks,
  tags,
  type NewCollectionCompanyLink,
  type NewCompany
} from '@shared/db'
import {
  flushPendingAssets,
  pickFirstAssetUrl,
  type PersistCompanyGraphResult,
  type PendingAssetTask
} from './types'

export class CompanyIngestPersistHandler {
  constructor(private readonly dbService: DbService) {}

  persistCompanyGraph(
    graph: IngestCompanyGraph,
    options?: IngestAddCompanyFromScraperOptions
  ): Promise<IngestAddCompanyFromScraperResult>
  persistCompanyGraph(
    graph: IngestCompanyGraph,
    options: IngestAddCompanyFromScraperOptions | undefined,
    tx: DbContext
  ): Promise<PersistCompanyGraphResult>
  async persistCompanyGraph(
    graph: IngestCompanyGraph,
    options?: IngestAddCompanyFromScraperOptions,
    tx?: DbContext
  ): Promise<IngestAddCompanyFromScraperResult | PersistCompanyGraphResult> {
    if (tx) {
      return this.persistCompanyGraphInternal(graph, options, tx)
    }

    const result = this.dbService.db.transaction((trx) =>
      this.persistCompanyGraphInternal(graph, options, trx)
    )
    const warnings = await flushPendingAssets(this.dbService, result.pendingAssets)
    return this.toPublicResult(result, warnings)
  }

  persistCompanyGraphInternal(
    graph: IngestCompanyGraph,
    options: IngestAddCompanyFromScraperOptions | undefined,
    tx: DbContext
  ): PersistCompanyGraphResult {
    return this.persistCompanyNodeInternal(graph.company, tx, options?.targetCollectionId)
  }

  persistCompanyNodeInternal(
    node: IngestCompanyNode,
    tx: DbContext,
    targetCollectionId?: string
  ): PersistCompanyGraphResult {
    const existing = this.findExistingCompany(node, tx)
    if (existing) {
      this.addToCollection(tx, existing.companyId, targetCollectionId)
      return {
        companyId: existing.companyId,
        isNew: false,
        existingReason: existing.existingReason,
        pendingAssets: []
      }
    }

    const core = node.core
    const companyId = nanoid()
    const newCompany: NewCompany = {
      id: companyId,
      name: core.name,
      originalName: core.originalName,
      foundedDate: core.foundedDate,
      description: core.description,
      relatedSites: core.relatedSites || []
    }

    tx.insert(companies).values(newCompany).run()

    for (const [index, extId] of normalizeExternalIds(core.externalIds).entries()) {
      tx.insert(companyExternalIds)
        .values({
          companyId,
          source: extId.source,
          externalId: extId.id,
          orderInCompany: index
        })
        .onConflictDoNothing()
        .run()
    }

    for (let i = 0; i < (core.tags?.length ?? 0); i++) {
      const tagData = core.tags![i]

      tx.insert(tags)
        .values({ name: tagData.name, isNsfw: tagData.isNsfw })
        .onConflictDoNothing()
        .run()

      const existingTag = this.dbService.helper.findExistingTag({ name: tagData.name }, tx)
      if (!existingTag) {
        continue
      }

      tx.insert(companyTagLinks)
        .values({
          companyId,
          tagId: existingTag.id,
          isSpoiler: tagData.isSpoiler || false,
          note: tagData.note || null,
          orderInCompany: i,
          orderInTag: 0
        })
        .run()
    }

    const pendingAssets: PendingAssetTask[] = []
    const logoUrl = pickFirstAssetUrl(node.logoUrls)
    if (logoUrl) {
      pendingAssets.push({ type: 'company', companyId, url: logoUrl })
    }

    this.addToCollection(tx, companyId, targetCollectionId)

    return {
      companyId,
      isNew: true,
      pendingAssets
    }
  }

  private findExistingCompany(
    node: IngestCompanyNode,
    tx: DbContext
  ): { companyId: string; existingReason: 'externalId' } | undefined {
    const core = node.core

    if (core.externalIds?.length) {
      const existingByExternalId = this.dbService.helper.findExistingCompany(
        { externalIds: core.externalIds },
        tx
      )
      if (existingByExternalId) {
        return { companyId: existingByExternalId.id, existingReason: 'externalId' }
      }
    }

    return undefined
  }

  private addToCollection(tx: DbContext, companyId: string, targetCollectionId?: string): void {
    if (!targetCollectionId) return

    const collectionLink: NewCollectionCompanyLink = {
      collectionId: targetCollectionId,
      companyId,
      orderInCollection: 0
    }

    tx.insert(collectionCompanyLinks).values(collectionLink).onConflictDoNothing().run()
  }

  private toPublicResult(
    result: PersistCompanyGraphResult,
    warnings: IngestWarning[]
  ): IngestAddCompanyFromScraperResult {
    const { pendingAssets, ...publicResult } = result
    void pendingAssets
    return warnings.length > 0 ? { ...publicResult, warnings } : publicResult
  }
}
