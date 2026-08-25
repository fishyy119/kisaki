import type { AnySQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { AllEntityType } from '@shared/common'
import type { TableName } from '@shared/db/table-names'
import type { EntityMergeChangeKind } from '@shared/entity-merge'
import type { ExternalId } from '@shared/identity'
import type { DbContext } from '../../types'
import type { ExternalIdLinkTable } from '../../helper/external-id'

/**
 * A row read through a runtime table reference. Merge configs erase the
 * per-table row types, so field access goes through the config's field names
 * and values are narrowed where their type matters.
 */
export type MergeRow = Record<string, unknown>

export interface StagedMergeFile {
  tableName: TableName
  rowId: string
  fileName: string
}

export interface AttachmentStageResult {
  patch: MergeRow
  stagedFiles: StagedMergeFile[]
}

export interface ExternalIdMergeConfig {
  link: ExternalIdLinkTable
  /** Owner id property on the row object, used when rewriting rows. */
  entityIdField: string
  orderField: string
}

/** Moves an entity's owned rows from the source to the target before deletion. */
export type OwnedDataMerge = (
  db: DbContext,
  targetId: string,
  sourceId: string,
  now: Date
) => number

/**
 * Folds the source's same-class relation edges into the target. Both ends name
 * the merged class, so these cannot go through the link machinery below: an
 * edge between the two merged entities collapses onto itself and must vanish,
 * which is only visible when both ends are rewritten in one pass.
 */
export type SameClassRelationMerge = (
  db: DbContext,
  targetId: string,
  sourceId: string,
  now: Date
) => number

/**
 * A cross-class attachment link, owned by one endpoint. The other endpoints
 * belong to a different class and are never rewritten by this entity's merge.
 */
export interface RelationMergeConfig {
  table: SQLiteTable
  /** Owner id property on the row object, rewritten from source to target. */
  mergeField: string
  mergeColumn: AnySQLiteColumn
  uniqueKeyFields: string[]
  orderField?: string
  spoilerField?: string
  noteField?: string
}

export interface EntityMergeConfig {
  entityType: AllEntityType
  table: SQLiteTable
  idColumn: AnySQLiteColumn
  externalIds?: ExternalIdMergeConfig
  relations: RelationMergeConfig[]
}

export interface ExternalIdMergePlan {
  rows: ExternalId[]
}

export type MergeChangedCounts = Partial<Record<EntityMergeChangeKind, number>>
