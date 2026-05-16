import type { DbContext, DbService } from '@main/services/db'
import type {
  IngestAddPersonFromScraperOptions,
  IngestAddPersonFromScraperResult
} from '@shared/ingest/add'
import type { IngestWarning } from '@shared/ingest'
import { normalizeExternalIds } from '@shared/identity'
import { nanoid } from 'nanoid'
import {
  collectionPersonLinks,
  personExternalIds,
  personTagLinks,
  persons,
  tags,
  type NewCollectionPersonLink,
  type NewPerson
} from '@shared/db'
import type { IngestPersonGraph, IngestPersonNode } from '../graph'
import { flushPendingAssets, type PendingAssetTask } from '../assets'
import { pickFirstAssetUrl, type PersistPersonGraphResult } from './types'

export class PersonIngestPersistHandler {
  constructor(private readonly dbService: DbService) {}

  persistPersonGraph(
    graph: IngestPersonGraph,
    options?: IngestAddPersonFromScraperOptions
  ): Promise<IngestAddPersonFromScraperResult>
  persistPersonGraph(
    graph: IngestPersonGraph,
    options: IngestAddPersonFromScraperOptions | undefined,
    tx: DbContext
  ): Promise<PersistPersonGraphResult>
  async persistPersonGraph(
    graph: IngestPersonGraph,
    options?: IngestAddPersonFromScraperOptions,
    tx?: DbContext
  ): Promise<IngestAddPersonFromScraperResult | PersistPersonGraphResult> {
    if (tx) {
      return this.persistPersonGraphInternal(graph, options, tx)
    }

    const result = this.dbService.client.transaction((trx) =>
      this.persistPersonGraphInternal(graph, options, trx)
    )
    const warnings = await flushPendingAssets(this.dbService, result.pendingAssets)
    return this.toPublicResult(result, warnings)
  }

  persistPersonGraphInternal(
    graph: IngestPersonGraph,
    options: IngestAddPersonFromScraperOptions | undefined,
    tx: DbContext
  ): PersistPersonGraphResult {
    return this.persistPersonNodeInternal(graph.person, tx, options?.targetCollectionId)
  }

  persistPersonNodeInternal(
    node: IngestPersonNode,
    tx: DbContext,
    targetCollectionId?: string
  ): PersistPersonGraphResult {
    const existing = this.findExistingPerson(node, tx)
    if (existing) {
      this.addToCollection(tx, existing.personId, targetCollectionId)
      return {
        personId: existing.personId,
        isNew: false,
        existingReason: existing.existingReason,
        pendingAssets: []
      }
    }

    const core = node.core
    const personId = nanoid()
    const newPerson: NewPerson = {
      id: personId,
      name: core.name,
      originalName: core.originalName,
      birthDate: core.birthDate,
      deathDate: core.deathDate,
      gender: core.gender,
      description: core.description,
      relatedSites: core.relatedSites || []
    }

    tx.insert(persons).values(newPerson).run()

    for (const [index, extId] of normalizeExternalIds(core.externalIds).entries()) {
      tx.insert(personExternalIds)
        .values({
          personId,
          source: extId.source,
          externalId: extId.id,
          orderInPerson: index
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

      const existingTag = this.dbService.entityFinder.findExistingTag({ name: tagData.name }, tx)
      if (!existingTag) {
        continue
      }

      tx.insert(personTagLinks)
        .values({
          personId,
          tagId: existingTag.id,
          isSpoiler: tagData.isSpoiler || false,
          note: tagData.note || null,
          orderInPerson: i,
          orderInTag: 0
        })
        .run()
    }

    const pendingAssets: PendingAssetTask[] = []
    const photoUrl = pickFirstAssetUrl(node.photoUrls)
    if (photoUrl) {
      pendingAssets.push({ type: 'person', personId, url: photoUrl })
    }

    this.addToCollection(tx, personId, targetCollectionId)

    return {
      personId,
      isNew: true,
      pendingAssets
    }
  }

  private findExistingPerson(
    node: IngestPersonNode,
    tx: DbContext
  ): { personId: string; existingReason: 'externalId' } | undefined {
    const core = node.core

    if (core.externalIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExistingPerson(
        { externalIds: core.externalIds },
        tx
      )
      if (existingByExternalId) {
        return { personId: existingByExternalId.id, existingReason: 'externalId' }
      }
    }

    return undefined
  }

  private addToCollection(tx: DbContext, personId: string, targetCollectionId?: string): void {
    if (!targetCollectionId) return

    const collectionLink: NewCollectionPersonLink = {
      collectionId: targetCollectionId,
      personId,
      orderInCollection: 0
    }

    tx.insert(collectionPersonLinks).values(collectionLink).onConflictDoNothing().run()
  }

  private toPublicResult(
    result: PersistPersonGraphResult,
    warnings: IngestWarning[]
  ): IngestAddPersonFromScraperResult {
    const { pendingAssets, ...publicResult } = result
    void pendingAssets
    return warnings.length > 0 ? { ...publicResult, warnings } : publicResult
  }
}
