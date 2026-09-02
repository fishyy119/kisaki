import type { AllEntityType } from './entity-types'

/**
 * Request payload for delete preview queries.
 */
export interface EntityDeletePreviewRequest {
  entityType: AllEntityType
  entityIds: string[]
}

/**
 * A root entity selected for deletion.
 */
export interface EntityDeletePreviewItem {
  id: string
  name: string
}

/**
 * A directly related entity type that can also be deleted.
 */
export interface EntityDeletePreviewOption {
  entityType: AllEntityType
  count: number
}

/**
 * Preview data for a delete dialog.
 */
export interface EntityDeletePreview {
  entityType: AllEntityType
  items: EntityDeletePreviewItem[]
  relatedOptions: EntityDeletePreviewOption[]
}

/**
 * Request payload for entity deletion with optional related entity cleanup.
 */
export interface EntityDeleteRequest {
  entityType: AllEntityType
  entityIds: string[]
  deleteRelatedTypes?: AllEntityType[]
}

/**
 * Delete result counts grouped by entity type.
 */
export interface EntityDeleteResult {
  deletedCounts: Partial<Record<AllEntityType, number>>
}
