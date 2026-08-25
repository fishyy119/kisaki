import type { CollectionImportPlanItem, IndexImportPlanItem } from '../../import/planner'
import type { BangumiMediaScope } from '../../../shared/scopes'
import type {
  LocalCollectionTarget,
  LocalMediaAdapter,
  LocalMediaItem,
  LocalMediaUserPatch,
  LocalUnitProgress
} from '../../media/types'
import type { BangumiJobPreviewGroup, BangumiJobPreviewRow } from '../../../shared/settings'

export interface CollectionLocalUpdatePlan {
  patch: LocalMediaUserPatch
  tagNames: readonly string[]
  targetCollection?: LocalCollectionTarget
  /** Remote unit counts to adopt locally; present when ahead of local state. */
  unitProgress?: LocalUnitProgress
  rows: readonly BangumiJobPreviewRow[]
}

export type ExecutableCollectionImportPlanItem = CollectionImportPlanItem & {
  action: Extract<CollectionImportPlanItem['action'], { kind: 'create' | 'patch' }>
}

export type ExecutableIndexImportPlanItem = IndexImportPlanItem & {
  action: Extract<IndexImportPlanItem['action'], { kind: 'create' | 'patch' }>
}

export type CollectionImportOperation =
  | { kind: 'create'; item: ExecutableCollectionImportPlanItem }
  | {
      kind: 'patch'
      item: ExecutableCollectionImportPlanItem
      localItem: LocalMediaItem
      updatePlan: CollectionLocalUpdatePlan
    }

export interface CollectedCollectionImport {
  scope: BangumiMediaScope
  adapter?: LocalMediaAdapter
  targetCollection?: LocalCollectionTarget
  planItems: readonly CollectionImportPlanItem[]
  operations: readonly CollectionImportOperation[]
  skippedNoChange: number
}

export type IndexImportOperation =
  | { kind: 'create'; item: ExecutableIndexImportPlanItem }
  | {
      kind: 'patch'
      item: ExecutableIndexImportPlanItem
      localItem: LocalMediaItem
      targetCollection: LocalCollectionTarget
      previewGroup: BangumiJobPreviewGroup
    }

export interface CollectedIndexImport {
  scope: BangumiMediaScope
  adapter?: LocalMediaAdapter
  targetCollection?: LocalCollectionTarget
  planItems: readonly IndexImportPlanItem[]
  operations: readonly IndexImportOperation[]
  skippedNoChange: number
}
