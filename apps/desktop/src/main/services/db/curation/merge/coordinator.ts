import { eq, inArray } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { EntityMergeRequest, EntityMergeResult } from '@shared/entity-merge'
import { normalizeExternalIds, type ExternalId } from '@shared/identity'
import type { IpcService } from '@main/services/ipc'
import { createLogger } from '@main/log'
import * as schema from '@shared/db/schema'
import type { AttachmentStore } from '../../attachment'
import type { DbHooks } from '../../hooks'
import type { DbContext, DbQueryContext, DbWriteContext } from '../../types'
import { requireExternalIdsAvailable } from '../../identity/external-id'
import { ENTITY_MERGE_CONFIGS } from './configs'
import { cleanupStagedMergeFiles, stageEntityAttachments } from './attachments'
import { buildEntityFieldPatch } from './fields'
import { rewriteMergeFilters } from './filters'
import { OWNED_DATA_MERGES, SAME_CLASS_RELATION_MERGES, mergeRelationRows } from './relations'
import type {
  EntityMergeConfig,
  ExternalIdMergeConfig,
  ExternalIdMergePlan,
  MergeChangedCounts,
  MergeRow,
  StagedMergeFile
} from './types'

const log = createLogger('Db')

export class EntityMergeCoordinator {
  constructor(
    private readonly db: BetterSQLite3Database<typeof schema>,
    private readonly attachment: AttachmentStore,
    private readonly hooks: DbHooks,
    private readonly ipc: IpcService
  ) {}

  async apply(params: EntityMergeRequest): Promise<EntityMergeResult> {
    const entityType = params.entityType
    const config = ENTITY_MERGE_CONFIGS[entityType]
    if (!config) {
      throw new Error('Unsupported entity merge type.')
    }

    const targetId = normalizeId(params.targetId)
    const sourceId = normalizeId(params.sourceId)
    if (!targetId || !sourceId) {
      throw new Error('Entity merge IDs are required.')
    }
    if (targetId === sourceId) {
      throw new Error('Entity merge source must differ from target.')
    }

    const target = this.getEntityRow(this.db, config, targetId)
    const source = this.getEntityRow(this.db, config, sourceId)
    if (!target || !source) {
      throw new Error('Entity merge target or source was not found.')
    }

    const veto = await this.hooks.entityMerging.dispatch({ entityType, targetId, sourceId })
    if (veto) {
      throw new Error('Entity merge was cancelled by an extension hook.')
    }

    const stagedFiles: StagedMergeFile[] = []
    let attachmentStage: Awaited<ReturnType<typeof stageEntityAttachments>>
    try {
      attachmentStage = await stageEntityAttachments(
        entityType,
        this.attachment,
        targetId,
        sourceId,
        target,
        source
      )
    } catch (error) {
      log.error('Entity merge attachment staging failed.', error, { entityType })
      throw new Error('Failed to stage merge attachments.', { cause: error })
    }
    stagedFiles.push(...attachmentStage.stagedFiles)

    const changedCounts: MergeChangedCounts = {}
    const now = new Date()

    try {
      // Rows are re-read and re-planned inside the transaction; the pre-hook
      // snapshot only drives attachment staging, which must happen outside it.
      this.db.transaction((tx) => {
        const currentTarget = this.getEntityRow(tx, config, targetId)
        const currentSource = this.getEntityRow(tx, config, sourceId)
        if (!currentTarget || !currentSource) {
          throw new Error('Entity merge target or source was not found.')
        }

        const patch = buildEntityFieldPatch(
          entityType,
          currentTarget,
          currentSource,
          attachmentStage.patch,
          now
        )
        ;(tx as DbWriteContext)
          .update(config.table)
          .set(patch)
          .where(eq(config.idColumn, targetId))
          .run()
        changedCounts.fields = countFieldChanges(patch)

        if (config.externalIds) {
          const externalIdPlan = this.buildExternalIdPlan(
            tx,
            config.externalIds,
            targetId,
            sourceId
          )
          changedCounts.externalIds = this.writeExternalIds(
            tx,
            config.externalIds,
            targetId,
            sourceId,
            externalIdPlan
          )
        }

        let relationChanges = 0
        const mergeOwnedData = OWNED_DATA_MERGES[entityType]
        if (mergeOwnedData) {
          relationChanges += mergeOwnedData(tx, targetId, sourceId, now)
        }

        const mergeSameClassRelations = SAME_CLASS_RELATION_MERGES[entityType]
        if (mergeSameClassRelations) {
          relationChanges += mergeSameClassRelations(tx, targetId, sourceId, now)
        }

        for (const relationConfig of config.relations) {
          relationChanges += mergeRelationRows(tx, relationConfig, targetId, sourceId, now)
        }
        changedCounts.relations = relationChanges

        changedCounts.filters = rewriteMergeFilters(tx, entityType, targetId, sourceId, now)
        ;(tx as DbWriteContext).delete(config.table).where(eq(config.idColumn, sourceId)).run()
        changedCounts.source = 1
      })
    } catch (error) {
      await cleanupStagedMergeFiles(this.attachment, stagedFiles)
      log.error('Entity merge transaction failed.', error, {
        entityType,
        stagedFileCount: stagedFiles.length
      })
      throw new Error('Failed to merge entities.', { cause: error })
    }

    changedCounts.attachments = stagedFiles.length

    const merged = { entityType, targetId, sourceId, occurredAt: Date.now() }
    this.hooks.entityMerged.dispatch(merged)
    this.ipc.send('library:entity-merged', merged)

    return {
      entityType,
      targetId,
      sourceId,
      changedCounts
    }
  }

  private getEntityRow(tx: DbContext, config: EntityMergeConfig, id: string): MergeRow | null {
    const row = (tx as DbQueryContext)
      .select()
      .from(config.table)
      .where(eq(config.idColumn, id))
      .get() as MergeRow | undefined

    return row ?? null
  }

  private buildExternalIdPlan(
    tx: DbContext,
    config: ExternalIdMergeConfig,
    targetId: string,
    sourceId: string
  ): ExternalIdMergePlan {
    const rows = (tx as DbQueryContext)
      .select()
      .from(config.link.table)
      .where(inArray(config.link.entityIdColumn, [targetId, sourceId]))
      .all() as MergeRow[]

    const byOwner = (ownerId: string): ExternalId[] =>
      rows
        .filter((row) => row[config.entityIdField] === ownerId)
        .sort((a, b) => toOrder(a[config.orderField]) - toOrder(b[config.orderField]))
        .map(toExternalId)

    const merged = normalizeExternalIds([...byOwner(targetId), ...byOwner(sourceId)])
    requireExternalIdsAvailable(tx, config.link, [targetId, sourceId], merged)

    return { rows: merged }
  }

  private writeExternalIds(
    tx: DbContext,
    config: ExternalIdMergeConfig,
    targetId: string,
    sourceId: string,
    plan: ExternalIdMergePlan
  ): number {
    ;(tx as DbWriteContext)
      .delete(config.link.table)
      .where(inArray(config.link.entityIdColumn, [targetId, sourceId]))
      .run()

    if (plan.rows.length === 0) {
      return 0
    }

    ;(tx as DbWriteContext)
      .insert(config.link.table)
      .values(
        plan.rows.map((externalId, index) => ({
          [config.entityIdField]: targetId,
          source: externalId.source,
          externalId: externalId.id,
          [config.orderField]: index
        }))
      )
      .run()

    return plan.rows.length
  }
}

function normalizeId(id: string): string {
  return typeof id === 'string' ? id.trim() : ''
}

// External-id link rows always store text source/externalId columns.
function toExternalId(row: MergeRow): ExternalId {
  return {
    source: String(row.source ?? ''),
    id: String(row.externalId ?? '')
  }
}

function toOrder(value: unknown): number {
  return typeof value === 'number' ? value : 0
}

function countFieldChanges(patch: MergeRow): number {
  return Object.keys(patch).filter((key) => key !== 'updatedAt').length
}
