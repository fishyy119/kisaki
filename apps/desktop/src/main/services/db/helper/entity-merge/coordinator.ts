import { eq, inArray } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { EntityMergeRequest, EntityMergeResult } from '@shared/entity-merge'
import { normalizeExternalIds, type ExternalId } from '@shared/identity'
import type { IpcService } from '@main/services/ipc'
import { createLogger } from '@main/log'
import * as schema from '@shared/db/schema'
import type { AttachmentStore } from '../../attachment'
import type { DbHooks } from '../../hooks'
import { ENTITY_MERGE_CONFIGS } from './configs'
import { cleanupStagedMergeFiles, stageEntityAttachments } from './attachments'
import { buildEntityFieldPatch } from './fields'
import { rewriteMergeFilters } from './filters'
import { mergeGameNotes, mergeGameSessions, mergeRelationRows } from './relations'
import type {
  EntityMergeConfig,
  ExternalIdMergeConfig,
  ExternalIdMergePlan,
  MergeChangedCounts,
  MergeRow,
  StagedMergeFile
} from './types'

const log = createLogger('Db')

export class DbEntityMergeCoordinator {
  constructor(
    private readonly db: BetterSQLite3Database<typeof schema>,
    private readonly attachment: AttachmentStore,
    private readonly hooks: DbHooks,
    private readonly ipc: IpcService
  ) {}

  async merge(params: EntityMergeRequest): Promise<EntityMergeResult> {
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

    const target = this.getEntityRow(config, targetId)
    const source = this.getEntityRow(config, sourceId)
    if (!target || !source) {
      throw new Error('Entity merge target or source was not found.')
    }

    const veto = await this.hooks.entityMerging.dispatch({ entityType, targetId, sourceId })
    if (veto) {
      throw new Error('Entity merge was cancelled by an extension hook.')
    }

    const externalIdPlan = config.externalIds
      ? this.buildExternalIdPlan(config.externalIds, targetId, sourceId)
      : null

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
      this.db.transaction((tx) => {
        const patch = buildEntityFieldPatch(entityType, target, source, attachmentStage.patch, now)
        ;(tx as any).update(config.table).set(patch).where(eq(config.idColumn, targetId)).run()
        changedCounts.fields = countFieldChanges(patch)

        if (config.externalIds && externalIdPlan) {
          changedCounts.externalIds = this.writeExternalIds(
            tx,
            config.externalIds,
            targetId,
            sourceId,
            externalIdPlan
          )
        }

        let relationChanges = 0
        if (entityType === 'game') {
          relationChanges += mergeGameSessions(tx, targetId, sourceId, now)
          relationChanges += mergeGameNotes(tx, targetId, sourceId, now)
        }

        for (const relationConfig of config.relations) {
          relationChanges += mergeRelationRows(tx, relationConfig, targetId, sourceId, now)
        }
        changedCounts.relations = relationChanges

        changedCounts.filters = rewriteMergeFilters(tx, entityType, targetId, sourceId, now)
        ;(tx as any).delete(config.table).where(eq(config.idColumn, sourceId)).run()
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

  private getEntityRow(config: EntityMergeConfig, id: string): MergeRow | null {
    const row = (this.db as any)
      .select()
      .from(config.table)
      .where(eq(config.idColumn, id))
      .get() as MergeRow | undefined

    return row ?? null
  }

  private buildExternalIdPlan(
    config: ExternalIdMergeConfig,
    targetId: string,
    sourceId: string
  ): ExternalIdMergePlan {
    const rows = (this.db as any)
      .select()
      .from(config.table)
      .where(inArray(config.entityIdColumn, [targetId, sourceId]))
      .all() as MergeRow[]

    const targetExternalIds = rows
      .filter((row) => row[config.entityIdField] === targetId)
      .sort((a, b) => (a[config.orderField] ?? 0) - (b[config.orderField] ?? 0))
      .map(toExternalId)
    const sourceExternalIds = rows
      .filter((row) => row[config.entityIdField] === sourceId)
      .sort((a, b) => (a[config.orderField] ?? 0) - (b[config.orderField] ?? 0))
      .map(toExternalId)
    const merged = normalizeExternalIds([...targetExternalIds, ...sourceExternalIds])

    const mergedKeys = new Set(merged.map((externalId) => toExternalIdKey(externalId)))
    const allRows = (this.db as any).select().from(config.table).all() as MergeRow[]
    for (const row of allRows) {
      const [normalized] = normalizeExternalIds([toExternalId(row)])
      if (!normalized || !mergedKeys.has(toExternalIdKey(normalized))) continue

      const ownerId = row[config.entityIdField]
      if (ownerId && ownerId !== targetId && ownerId !== sourceId) {
        throw new Error('External ID already belongs to another entity.')
      }
    }

    return { rows: merged }
  }

  private writeExternalIds(
    tx: unknown,
    config: ExternalIdMergeConfig,
    targetId: string,
    sourceId: string,
    plan: ExternalIdMergePlan
  ): number {
    ;(tx as any)
      .delete(config.table)
      .where(inArray(config.entityIdColumn, [targetId, sourceId]))
      .run()

    if (plan.rows.length === 0) {
      return 0
    }

    ;(tx as any)
      .insert(config.table)
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

function toExternalId(row: MergeRow): ExternalId {
  return {
    source: row.source,
    id: row.externalId
  }
}

function toExternalIdKey(externalId: ExternalId): string {
  return `${externalId.source}\0${externalId.id}`
}

function countFieldChanges(patch: MergeRow): number {
  return Object.keys(patch).filter((key) => key !== 'updatedAt').length
}
