import type { AllEntityType } from './common'

export type EntityMergeChangeKind =
  'fields' | 'externalIds' | 'relations' | 'filters' | 'attachments' | 'source'

export interface EntityMergeRequest {
  entityType: AllEntityType
  targetId: string
  sourceId: string
}

export interface EntityMergeResult {
  entityType: AllEntityType
  targetId: string
  sourceId: string
  changedCounts: Partial<Record<EntityMergeChangeKind, number>>
}
