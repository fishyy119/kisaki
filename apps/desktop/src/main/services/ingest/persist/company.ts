import { resolveTagId, type DbContext, type DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type {
  IngestAddCompanyFromScraperOptions,
  IngestAddCompanyFromScraperResult
} from '@shared/ingest/add'
import type { IngestWarning } from '@shared/ingest'
import { normalizeExternalIds } from '@shared/identity'
import { nanoid } from 'nanoid'
import {
  collectionCompanyLinks,
  companies,
  companyExternalIds,
  companyTagLinks,
  type NewCollectionCompanyLink,
  type NewCompany
} from '@shared/db'
import type { IngestCompanyGraph, IngestCompanyNode } from '../graph'
import { flushPendingAssets, type PendingAssetTask } from '../assets'
import { pickFirstAssetUrl, type PersistCompanyGraphResult } from './types'
import { reportIngestProgress } from '../run/progress'
import type { IngestOperationOptions } from '../types'

type CompanyPersistOptions = IngestAddCompanyFromScraperOptions &
  Pick<IngestOperationOptions, 'signal' | 'onProgress'>

export class CompanyIngestPersistHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly i18nService: I18nService
  ) {}

  persistCompanyGraph(
    graph: IngestCompanyGraph,
    options?: CompanyPersistOptions
  ): Promise<IngestAddCompanyFromScraperResult>
  persistCompanyGraph(
    graph: IngestCompanyGraph,
    options: CompanyPersistOptions | undefined,
    tx: DbContext
  ): Promise<PersistCompanyGraphResult>
  async persistCompanyGraph(
    graph: IngestCompanyGraph,
    options?: CompanyPersistOptions,
    tx?: DbContext
  ): Promise<IngestAddCompanyFromScraperResult | PersistCompanyGraphResult> {
    if (tx) {
      return this.persistCompanyGraphInternal(graph, options, tx)
    }

    const result = this.dbService.client.transaction((trx) =>
      this.persistCompanyGraphInternal(graph, options, trx)
    )
    if (result.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: this.i18nService.messages.ingest.persist.savingMedia({ entity: 'company' })
      })
    }
    const warnings = await flushPendingAssets(this.dbService, result.pendingAssets, {
      signal: options?.signal
    })
    return this.toPublicResult(result, warnings)
  }

  persistCompanyGraphInternal(
    graph: IngestCompanyGraph,
    options: CompanyPersistOptions | undefined,
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
      externalSites: core.externalSites || []
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

      const tagId = resolveTagId(tx, tagData)
      if (!tagId) {
        continue
      }

      tx.insert(companyTagLinks)
        .values({
          companyId,
          tagId,
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
      pendingAssets.push({ table: 'companies', rowId: companyId, field: 'logoFile', url: logoUrl })
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
      const existingByExternalId = this.dbService.entityFinder.findExistingCompany(
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
    const publicResult: IngestAddCompanyFromScraperResult = {
      companyId: result.companyId,
      isNew: result.isNew
    }
    if (result.existingReason) {
      publicResult.existingReason = result.existingReason
    }
    if (warnings.length > 0) {
      publicResult.warnings = warnings
    }
    return publicResult
  }
}
