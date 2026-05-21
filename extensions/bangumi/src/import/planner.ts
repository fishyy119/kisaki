import type { BangumiMediaScope } from '../media/scopes'
import type { BangumiUserCollection } from '../api/types'
import type { LocalCollectionTarget, LocalMediaItem } from '../media/types'

export type PlannedImportAction =
  | {
      kind: 'create'
      scope: BangumiMediaScope
      subjectId: string
      name: string
      fields: readonly string[]
    }
  | {
      kind: 'patch'
      scope: BangumiMediaScope
      subjectId: string
      localId: string
      fields: readonly string[]
    }
  | { kind: 'skip'; scope: BangumiMediaScope; subjectId: string; reason: string }
  | { kind: 'unsupported'; scope: BangumiMediaScope; subjectId?: string; reason: string }
  | { kind: 'error'; scope: BangumiMediaScope; subjectId?: string; message: string }

export interface ImportPlannerWriteFields {
  status: boolean
  score: boolean
  tags: boolean
}

export interface CollectionImportPlanItem {
  scope: BangumiMediaScope
  subjectId: string
  collection: BangumiUserCollection
  localItem?: LocalMediaItem
  action: PlannedImportAction
}

export interface CollectionImportPlan {
  scope: BangumiMediaScope
  items: readonly CollectionImportPlanItem[]
}

export interface PlanCollectionsOptions {
  scope: BangumiMediaScope
  collections: readonly BangumiUserCollection[]
  localItems?: ReadonlyMap<string, LocalMediaItem>
  localWritable: boolean
  patchExisting: boolean
  fields: ImportPlannerWriteFields
  targetCollection?: LocalCollectionTarget
}

export class ImportPlanner {
  createUnsupported(scope: BangumiMediaScope, reason: string): PlannedImportAction {
    return {
      kind: 'unsupported',
      scope,
      reason
    }
  }

  planCollections(options: PlanCollectionsOptions): CollectionImportPlan {
    const items: CollectionImportPlanItem[] = []

    for (const collection of options.collections) {
      const subjectId = readCollectionSubjectId(collection)
      if (!subjectId) {
        items.push({
          scope: options.scope,
          subjectId: '',
          collection,
          action: {
            kind: 'error',
            scope: options.scope,
            message: 'Bangumi 收藏缺少有效 subject ID。'
          }
        })
        continue
      }

      const localItem = options.localItems?.get(subjectId)
      items.push({
        scope: options.scope,
        subjectId,
        collection,
        ...(localItem ? { localItem } : {}),
        action: this.planCollectionItem({
          scope: options.scope,
          subjectId,
          collection,
          localItem,
          localWritable: options.localWritable,
          patchExisting: options.patchExisting,
          fields: options.fields,
          targetCollection: options.targetCollection
        })
      })
    }

    return {
      scope: options.scope,
      items
    }
  }

  private planCollectionItem({
    scope,
    subjectId,
    collection,
    localItem,
    localWritable,
    patchExisting,
    fields,
    targetCollection
  }: {
    scope: BangumiMediaScope
    subjectId: string
    collection: BangumiUserCollection
    localItem: LocalMediaItem | undefined
    localWritable: boolean
    patchExisting: boolean
    fields: ImportPlannerWriteFields
    targetCollection: LocalCollectionTarget | undefined
  }): PlannedImportAction {
    if (!localWritable) {
      return {
        kind: 'unsupported',
        scope,
        subjectId,
        reason: 'local_media_unsupported'
      }
    }

    if (localItem) {
      if (!patchExisting) {
        return {
          kind: 'skip',
          scope,
          subjectId,
          reason: 'existingLocalItem'
        }
      }

      return {
        kind: 'patch',
        scope,
        subjectId,
        localId: localItem.localId,
        fields: describeCollectionFields(fields, targetCollection)
      }
    }

    return {
      kind: 'create',
      scope,
      subjectId,
      name: readCollectionTitle(collection, subjectId),
      fields: describeCollectionFields(fields, targetCollection)
    }
  }
}

function readCollectionSubjectId(collection: BangumiUserCollection): string {
  const subjectId =
    normalizePositiveInteger(collection.subject_id) ??
    normalizePositiveInteger(collection.subject?.id)
  return subjectId ? String(subjectId) : ''
}

function readCollectionTitle(collection: BangumiUserCollection, subjectId: string): string {
  return (
    collection.subject?.name_cn?.trim() ||
    collection.subject?.name?.trim() ||
    `Bangumi ${subjectId}`
  )
}

function describeCollectionFields(
  fields: ImportPlannerWriteFields,
  targetCollection: LocalCollectionTarget | undefined
): readonly string[] {
  const names: string[] = []

  if (fields.status) {
    names.push('status')
  }

  if (fields.score) {
    names.push('score')
  }

  if (fields.tags) {
    names.push('tags')
  }

  if (targetCollection) {
    names.push('collection')
  }

  return names
}

function normalizePositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : undefined
}
