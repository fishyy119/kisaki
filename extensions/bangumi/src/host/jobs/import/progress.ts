import type { CollectionImportPlanItem, IndexImportPlanItem } from '../../import/planner'
import { m } from '../../i18n'
import type { BangumiMediaScope } from '../../../shared/scopes'
import { BangumiExtensionError } from '../../utils/errors'
import { omitUndefined } from '../../utils/object'
import type { JobStateController } from '../context'
import type { CollectionImportOperation, IndexImportOperation } from './model'

export function recordUnsupportedImportResult(
  job: JobStateController,
  scope: BangumiMediaScope
): void {
  job.increment('skippedUnsupportedScope')
  job.report('completed', m().jobs.import.writeUnsupported({ scope }), {
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
  scope: BangumiMediaScope,
  total: number
): void {
  if (total <= 0) {
    return
  }

  job.report('processingCollectionImport', m().jobs.import.preparing({ scope }), {
    current: 0,
    total,
    ratePeriod: 'minute'
  })
}

export function reportIndexImportExecutionStart(
  job: JobStateController,
  scope: BangumiMediaScope,
  total: number
): void {
  if (total <= 0) {
    return
  }

  job.report('processingIndexImport', m().jobs.import.preparing({ scope }), {
    current: 0,
    total,
    ratePeriod: 'minute'
  })
}

export function reportCollectionImportExecutionProgress({
  job,
  actionKind,
  scope,
  current,
  total
}: {
  job: JobStateController
  actionKind: CollectionImportOperation['kind']
  scope: BangumiMediaScope
  current: number
  total: number
}): void {
  if (actionKind === 'create') {
    job.report('creatingLocalItems', m().jobs.import.creatingLocal({ scope }), {
      current,
      total,
      ratePeriod: 'minute'
    })
    return
  }

  job.report('patchingLocalItems', m().jobs.import.patchingLocal({ scope }), {
    current,
    total,
    ratePeriod: 'minute'
  })
}

export function reportIndexImportExecutionProgress({
  job,
  actionKind,
  scope,
  current,
  total
}: {
  job: JobStateController
  actionKind: IndexImportOperation['kind']
  scope: BangumiMediaScope
  current: number
  total: number
}): void {
  if (actionKind === 'patch') {
    job.report('patchingLocalItems', m().jobs.import.patchingLocal({ scope }), {
      current,
      total,
      ratePeriod: 'minute'
    })
    return
  }

  job.report('creatingLocalItems', m().jobs.import.creatingLocal({ scope }), {
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
      job.addError(
        new BangumiExtensionError('bangumi_validation', action.message),
        omitUndefined({
          scope: action.scope,
          subjectId: action.subjectId
        })
      )
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
