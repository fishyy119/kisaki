import type { CollectionImportPlanItem, IndexImportPlanItem } from '../../import/planner'
import { getMediaScopeLabel } from '../../media/labels'
import type { BangumiMediaScope } from '../../media/scopes'
import { BangumiExtensionError } from '../../shared/errors'
import type { JobStateController } from '../context'
import type { CollectionImportOperation, IndexImportOperation } from './model'

export function recordUnsupportedImportResult(
  job: JobStateController,
  scope: BangumiMediaScope
): void {
  job.increment('skippedUnsupportedScope')
  job.report('completed', `${getMediaScopeLabel(scope)}暂不支持写入本地库。`, {
    current: 1,
    total: 1
  })
}

export function incrementSkippedNoChange(job: JobStateController, amount: number): void {
  if (amount > 0) {
    job.increment('skippedNoChange', amount)
  }
}

export function recordSkippedCollectionImportPlanItems(
  job: JobStateController,
  planItems: readonly CollectionImportPlanItem[]
): void {
  for (const item of planItems) {
    recordSkippedImportAction(job, item.action)
  }
}

export function recordSkippedIndexImportPlanItems(
  job: JobStateController,
  planItems: readonly IndexImportPlanItem[]
): void {
  for (const item of planItems) {
    recordSkippedImportAction(job, item.action)
  }
}

export function reportCollectionImportExecutionStart(
  job: JobStateController,
  label: string,
  total: number
): void {
  if (total <= 0) {
    return
  }

  job.report('processingCollectionImport', `正在准备导入${label}...`, {
    current: 0,
    total,
    ratePeriod: 'minute'
  })
}

export function reportIndexImportExecutionStart(
  job: JobStateController,
  label: string,
  total: number
): void {
  if (total <= 0) {
    return
  }

  job.report('processingIndexImport', `正在准备导入${label}...`, {
    current: 0,
    total,
    ratePeriod: 'minute'
  })
}

export function reportCollectionImportExecutionProgress({
  job,
  actionKind,
  label,
  current,
  total
}: {
  job: JobStateController
  actionKind: CollectionImportOperation['kind']
  label: string
  current: number
  total: number
}): void {
  if (actionKind === 'create') {
    job.report('creatingLocalItems', `正在添加${label}...`, {
      current,
      total,
      ratePeriod: 'minute'
    })
    return
  }

  job.report('patchingLocalItems', `正在更新${label}...`, {
    current,
    total,
    ratePeriod: 'minute'
  })
}

export function reportIndexImportExecutionProgress({
  job,
  actionKind,
  label,
  current,
  total
}: {
  job: JobStateController
  actionKind: IndexImportOperation['kind']
  label: string
  current: number
  total: number
}): void {
  if (actionKind === 'patch') {
    job.report('patchingLocalItems', `正在更新${label}...`, {
      current,
      total,
      ratePeriod: 'minute'
    })
    return
  }

  job.report('creatingLocalItems', `正在添加${label}...`, {
    current,
    total,
    ratePeriod: 'minute'
  })
}

function recordSkippedImportAction(
  job: JobStateController,
  action: CollectionImportPlanItem['action'] | IndexImportPlanItem['action']
): void {
  switch (action.kind) {
    case 'create':
    case 'patch':
      return
    case 'error':
      job.addError(new BangumiExtensionError('bangumi_validation', action.message), {
        scope: action.scope,
        subjectId: action.subjectId
      })
      job.increment('failedItems')
      return
    case 'skip':
      job.increment(
        action.reason === 'existingLocalItem' ? 'skippedExistingLocalItem' : 'skippedItems'
      )
      return
    case 'unsupported':
      job.increment('skippedUnsupportedScope')
      return
  }
}
