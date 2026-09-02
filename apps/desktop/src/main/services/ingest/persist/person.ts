import { resolveTagId, type DbContext, type DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type {
  IngestAddPersonFromScraperOptions,
  IngestAddPersonFromScraperResult
} from '@shared/ingest/add'
import type { IngestWarning } from '@shared/ingest'
import { normalizeExternalIds } from '@shared/identity'
import { newId } from '@shared/id'
import {
  collectionPersonLinks,
  personExternalIds,
  personTagLinks,
  persons,
  type NewCollectionPersonLink,
  type NewPerson
} from '@shared/db'
import type { IngestPersonGraph, IngestPersonNode } from '../graph'
import { flushPendingAssets, type PendingAssetTask } from '../assets'
import { pickFirstAssetUrl, type PersistPersonGraphResult } from './types'
import { reportIngestProgress } from '../run/progress'
import type { IngestOperationOptions } from '../types'

type PersonPersistOptions = IngestAddPersonFromScraperOptions &
  Pick<IngestOperationOptions, 'signal' | 'onProgress'>

export class PersonPersister {
  constructor(
    private readonly dbService: DbService,
    private readonly i18nService: I18nService
  ) {}

  persistPersonGraph(
    graph: IngestPersonGraph,
    options?: PersonPersistOptions
  ): Promise<IngestAddPersonFromScraperResult>
  persistPersonGraph(
    graph: IngestPersonGraph,
    options: PersonPersistOptions | undefined,
    tx: DbContext
  ): Promise<PersistPersonGraphResult>
  async persistPersonGraph(
    graph: IngestPersonGraph,
    options?: PersonPersistOptions,
    tx?: DbContext
  ): Promise<IngestAddPersonFromScraperResult | PersistPersonGraphResult> {
    if (tx) {
      return this.persistPersonGraphInternal(graph, options, tx)
    }

    const result = this.dbService.client.transaction((trx) =>
      this.persistPersonGraphInternal(graph, options, trx)
    )
    if (result.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: this.i18nService.messages.ingest.persist.savingMedia({ entity: 'person' })
      })
    }
    const warnings = await flushPendingAssets(this.dbService, result.pendingAssets, {
      signal: options?.signal
    })
    return this.toPublicResult(result, warnings)
  }

  persistPersonGraphInternal(
    graph: IngestPersonGraph,
    options: PersonPersistOptions | undefined,
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
    const personId = newId()
    const newPerson: NewPerson = {
      id: personId,
      name: core.name,
      originalName: core.originalName,
      aliases: core.aliases,
      birthDate: core.birthDate,
      deathDate: core.deathDate,
      gender: core.gender,
      description: core.description,
      externalSites: core.externalSites || []
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
      const tagData = core.tags![i]!

      const tagId = resolveTagId(tx, tagData)
      if (!tagId) {
        continue
      }

      tx.insert(personTagLinks)
        .values({
          personId,
          tagId,
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
      pendingAssets.push({ table: 'persons', rowId: personId, field: 'photoFile', url: photoUrl })
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
      const existingByExternalId = this.dbService.finder.findExisting(
        'person',
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
    const publicResult: IngestAddPersonFromScraperResult = {
      personId: result.personId,
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
