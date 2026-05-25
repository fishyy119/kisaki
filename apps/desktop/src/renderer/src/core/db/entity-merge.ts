import type { EntityMergeRequest, EntityMergeResult } from '@shared/entity-merge'
import { ipcManager, unwrapIpcData } from '../ipc'

export async function mergeEntities(params: EntityMergeRequest): Promise<EntityMergeResult> {
  return unwrapIpcData(await ipcManager.invoke('db:merge-entities', params))
}
