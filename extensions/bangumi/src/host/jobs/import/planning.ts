import type { CollectionImportPlanItem, IndexImportPlanItem } from '../../import/planner'
import type { LocalCollectionTarget, LocalMediaAdapter } from '../../media/types'
import { BangumiExtensionError } from '../../utils/errors'
import type { BangumiImportCollectionsArgs, BangumiImportIndexArgs } from '../args'
import type { JobStateController } from '../context'
import { buildCollectionLocalUpdatePlan, hasCollectionLocalChanges } from './local'
import type {
  CollectionImportOperation,
  ExecutableCollectionImportPlanItem,
  ExecutableIndexImportPlanItem,
  IndexImportOperation
} from './model'
import { createIndexCollectionPatchPreviewChange } from './preview'
import { isCancellationError } from '../summary'

export function emptyCollectedCollectionImport(label: string) {
  return {
    label,
    planItems: [],
    operations: [],
    skippedNoChange: 0
  }
}

export function emptyCollectedIndexImport(label: string) {
  return {
    label,
    planItems: [],
    operations: [],
    skippedNoChange: 0
  }
}

export async function collectCollectionImportOperations({
  adapter,
  args,
  job,
  planItems,
  targetCollection
}: {
  adapter: LocalMediaAdapter
  args: BangumiImportCollectionsArgs
  job: JobStateController
  planItems: readonly CollectionImportPlanItem[]
  targetCollection: LocalCollectionTarget | undefined
}): Promise<{ operations: readonly CollectionImportOperation[]; skippedNoChange: number }> {
  const executableItems = planItems.filter(isExecutableCollectionImportPlanItem)
  const operations: CollectionImportOperation[] = []
  let skippedNoChange = 0

  if (executableItems.length > 0) {
    job.report('collectingCollectionImportPlan', '正在计算需要导入的游戏...', {
      current: 0,
      total: executableItems.length
    })
  }

  for (const [index, planItem] of executableItems.entries()) {
    await job.checkpoint()
    job.report('collectingCollectionImportPlan', '正在计算需要导入的游戏...', {
      current: index + 1,
      total: executableItems.length
    })

    try {
      if (planItem.action.kind === 'create') {
        operations.push({ kind: 'create', item: planItem })
        continue
      }

      const localItem = planItem.localItem
      if (!localItem) {
        throw new BangumiExtensionError('library_update_failed', '本地条目不存在。')
      }

      const updatePlan = await buildCollectionLocalUpdatePlan({
        adapter,
        item: localItem,
        collection: planItem.collection,
        fields: args.fields,
        targetCollection
      })
      if (!hasCollectionLocalChanges(updatePlan)) {
        skippedNoChange += 1
        continue
      }

      operations.push({
        kind: 'patch',
        item: planItem,
        localItem,
        updatePlan
      })
    } catch (error) {
      if (isCancellationError(error) || job.signal.aborted) {
        throw error
      }
      job.addError(error, { scope: args.scope, subjectId: planItem.subjectId })
      job.increment('failedItems')
    }
  }

  return { operations, skippedNoChange }
}

export async function collectIndexImportOperations({
  adapter,
  args,
  job,
  planItems,
  targetCollection
}: {
  adapter: LocalMediaAdapter
  args: BangumiImportIndexArgs
  job: JobStateController
  planItems: readonly IndexImportPlanItem[]
  targetCollection: LocalCollectionTarget | undefined
}): Promise<{ operations: readonly IndexImportOperation[]; skippedNoChange: number }> {
  const executableItems = planItems.filter(isExecutableIndexImportPlanItem)
  const operations: IndexImportOperation[] = []
  let skippedNoChange = 0

  if (executableItems.length > 0) {
    job.report('collectingIndexImportPlan', '正在计算需要导入的游戏...', {
      current: 0,
      total: executableItems.length
    })
  }

  for (const [index, planItem] of executableItems.entries()) {
    await job.checkpoint()
    job.report('collectingIndexImportPlan', '正在计算需要导入的游戏...', {
      current: index + 1,
      total: executableItems.length
    })

    try {
      if (planItem.action.kind === 'create') {
        operations.push({ kind: 'create', item: planItem })
        continue
      }

      const localItem = planItem.localItem
      if (!localItem) {
        throw new BangumiExtensionError('library_update_failed', '本地条目不存在。')
      }
      if (!targetCollection) {
        throw new BangumiExtensionError('bangumi_validation', '请选择目标合集。')
      }

      const previewGroup = await createIndexCollectionPatchPreviewChange(
        adapter,
        localItem,
        Number(planItem.subjectId),
        targetCollection
      )
      if (!previewGroup) {
        skippedNoChange += 1
        continue
      }

      operations.push({
        kind: 'patch',
        item: planItem,
        localItem,
        targetCollection,
        previewGroup
      })
    } catch (error) {
      if (isCancellationError(error) || job.signal.aborted) {
        throw error
      }
      job.addError(error, { scope: args.scope, subjectId: planItem.subjectId })
      job.increment('failedItems')
    }
  }

  return { operations, skippedNoChange }
}

function isExecutableCollectionImportPlanItem(
  item: CollectionImportPlanItem
): item is ExecutableCollectionImportPlanItem {
  return Boolean(item.subjectId) && (item.action.kind === 'create' || item.action.kind === 'patch')
}

function isExecutableIndexImportPlanItem(
  item: IndexImportPlanItem
): item is ExecutableIndexImportPlanItem {
  return Boolean(item.subjectId) && (item.action.kind === 'create' || item.action.kind === 'patch')
}
