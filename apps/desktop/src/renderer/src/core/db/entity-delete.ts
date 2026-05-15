import type {
  EntityDeletePreview,
  EntityDeletePreviewRequest,
  EntityDeleteRequest,
  EntityDeleteResult
} from '@shared/entity-delete'
import { ipcManager } from '../ipc'

/**
 * Request delete preview data from the main process.
 */
export async function previewEntityDelete(
  params: EntityDeletePreviewRequest
): Promise<EntityDeletePreview> {
  const result = await ipcManager.invoke('db:preview-entity-delete', params)
  if (!result.success) {
    throw new Error('Could not load delete preview.')
  }

  return result.data
}

/**
 * Delete entities with optional direct-related entity cleanup.
 */
export async function deleteEntities(params: EntityDeleteRequest): Promise<EntityDeleteResult> {
  const result = await ipcManager.invoke('db:delete-entities', params)
  if (!result.success) {
    throw new Error('Could not delete entities.')
  }

  return result.data
}
