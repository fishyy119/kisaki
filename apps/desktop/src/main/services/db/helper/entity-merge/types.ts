import type { AllEntityType } from '@shared/common'
import type { EntityMergeChangeKind } from '@shared/entity-merge'
import type { ExternalId } from '@shared/identity'

export type MergeRow = Record<string, any>

export interface StagedMergeFile {
  tableName: string
  rowId: string
  fileName: string
}

export interface AttachmentStageResult {
  patch: MergeRow
  stagedFiles: StagedMergeFile[]
}

export interface ExternalIdMergeConfig {
  table: any
  entityIdField: string
  entityIdColumn: any
  orderField: string
  sourceColumn: any
  externalIdColumn: any
}

export interface RelationMergeConfig {
  table: any
  mergeField: string
  mergeColumn: any
  uniqueKeyFields: string[]
  orderField?: string
  spoilerField?: string
  noteField?: string
}

export interface EntityMergeConfig {
  entityType: AllEntityType
  table: any
  idColumn: any
  tableName: string
  externalIds?: ExternalIdMergeConfig
  relations: RelationMergeConfig[]
}

export interface ExternalIdMergePlan {
  rows: ExternalId[]
}

export type MergeChangedCounts = Partial<Record<EntityMergeChangeKind, number>>
