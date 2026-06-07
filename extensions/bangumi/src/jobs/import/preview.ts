import type { BangumiIndexSubject, BangumiUserCollection } from '../../api/types'
import type { CollectionImportPlanItem, IndexImportPlanItem } from '../../import/planner'
import { formatScopedCollectionType, getMediaScopeLabel } from '../../media/labels'
import type { BangumiMediaScope } from '../../media/scopes'
import type { LocalCollectionTarget, LocalMediaAdapter, LocalMediaItem } from '../../media/types'
import { BangumiExtensionError } from '../../shared/errors'
import { omitUndefined } from '../../shared/object'
import type { BangumiImportCollectionsArgs, BangumiImportIndexArgs } from '../args'
import type { JobStateController } from '../context'
import {
  formatCollectionScore,
  formatCollectionTags,
  formatLocalStatus,
  formatTargetCollectionValue,
  mapCollectionTypeToLocalStatus,
  readCollectionSubjectId
} from './local'
import type {
  CollectedCollectionImport,
  CollectedIndexImport,
  CollectionLocalUpdatePlan
} from './model'
import {
  createPreviewGroup,
  createRemotePreviewGroup,
  formatBangumiSubjectTitle
} from '../presentation'
import type { BangumiJobPreviewGroup, BangumiJobPreviewRow } from '../summary'

export function previewCollectionImport(
  args: BangumiImportCollectionsArgs,
  job: JobStateController,
  collected: CollectedCollectionImport
): void {
  reportCollectionImportPreviewStart(job, collected.operations.length)

  for (const [index, operation] of collected.operations.entries()) {
    if (operation.kind === 'create') {
      job.addPreviewGroup(
        createImportCollectionCreatePreviewChange({
          collection: operation.item.collection,
          fields: args.fields,
          targetCollection: collected.targetCollection,
          scope: args.scope
        })
      )
      job.increment('wouldImport')
    } else {
      job.addPreviewGroup(
        createImportCollectionPatchPreviewChangeFromPlan({
          item: operation.localItem,
          collection: operation.item.collection,
          updatePlan: operation.updatePlan,
          scope: args.scope
        })
      )
      job.increment('wouldPatch')
    }

    job.report('planningCollectionImport', '正在生成收藏导入预览...', {
      current: index + 1,
      total: collected.operations.length,
      ratePeriod: 'second'
    })
  }
}

export function previewIndexImport(
  args: BangumiImportIndexArgs,
  job: JobStateController,
  collected: CollectedIndexImport
): void {
  reportIndexImportPreviewStart(job, collected.operations.length)

  for (const [index, operation] of collected.operations.entries()) {
    if (operation.kind === 'create') {
      job.addPreviewGroup(
        createIndexCreatePreviewChange(
          operation.item.subject,
          collected.targetCollection,
          args.scope
        )
      )
      job.increment('wouldImport')
    } else {
      job.addPreviewGroup(operation.previewGroup)
      job.increment('wouldPatch')
    }

    job.report('planningIndexImport', '正在生成目录导入预览...', {
      current: index + 1,
      total: collected.operations.length,
      ratePeriod: 'second'
    })
  }
}

export async function createIndexCollectionPatchPreviewChange(
  adapter: LocalMediaAdapter,
  item: LocalMediaItem,
  subjectId: number,
  targetCollection: LocalCollectionTarget
): Promise<BangumiJobPreviewGroup | undefined> {
  const hasRelation =
    (await adapter.hasCollectionMembership?.(item.localId, targetCollection)) ?? false
  if (hasRelation) {
    return undefined
  }

  return createPreviewGroup({
    title: item.name,
    subjectId,
    badge: { label: '更新本地游戏', tone: 'info' },
    rows: [
      {
        label: '合集',
        before: '未加入',
        after: formatTargetCollectionValue(targetCollection),
        tone: 'success'
      }
    ]
  })
}

export function recordRemoteOnlyCollectionPreview(
  job: JobStateController,
  scope: BangumiMediaScope,
  planItems: readonly CollectionImportPlanItem[]
): void {
  for (const [index, planItem] of planItems.entries()) {
    const { collection, subjectId } = planItem
    if (!subjectId) {
      continue
    }
    job.report('buildingRemoteCollectionPreview', '正在生成远端收藏预览...', {
      current: index + 1,
      total: planItems.length
    })

    job.increment('remoteOnly')
    job.addPreviewGroup(
      createRemotePreviewGroup({
        scope,
        subjectId,
        title: collection.subject
          ? formatBangumiSubjectTitle(
              collection.subject.name_cn,
              collection.subject.name,
              subjectId
            )
          : `Bangumi ${subjectId}`,
        rows: [
          {
            label: '收藏状态',
            before: '远端',
            after: formatScopedCollectionType(scope, collection.type),
            tone: 'info'
          }
        ]
      })
    )
  }

  job.report('completed', `${getMediaScopeLabel(scope)}远端收藏预览完成。`, {
    current: planItems.length,
    total: planItems.length
  })
}

export function recordRemoteOnlyIndexPreview(
  job: JobStateController,
  scope: BangumiMediaScope,
  planItems: readonly IndexImportPlanItem[]
): void {
  for (const [index, planItem] of planItems.entries()) {
    const { action, subject, subjectId } = planItem
    if (action.kind === 'error') {
      job.addError(
        new BangumiExtensionError('bangumi_validation', action.message),
        omitUndefined({
          scope,
          subjectId: action.subjectId
        })
      )
      job.increment('failedItems')
      continue
    }

    if (!subjectId) {
      continue
    }
    job.report('buildingRemoteIndexPreview', '正在生成远端目录预览...', {
      current: index + 1,
      total: planItems.length
    })

    job.increment('remoteOnly')
    job.addPreviewGroup(
      createRemotePreviewGroup({
        scope,
        subjectId,
        title: formatBangumiSubjectTitle(subject.name_cn, subject.name, subjectId),
        rows: [
          {
            label: getMediaScopeLabel(scope),
            before: '目录条目',
            after: '远端预览',
            tone: 'info'
          }
        ]
      })
    )
  }

  job.report('completed', `${getMediaScopeLabel(scope)}目录远端预览完成。`, {
    current: planItems.length,
    total: planItems.length
  })
}

function createImportCollectionCreatePreviewChange({
  collection,
  fields,
  targetCollection,
  scope
}: {
  collection: BangumiUserCollection
  fields: BangumiImportCollectionsArgs['fields']
  targetCollection: LocalCollectionTarget | undefined
  scope: BangumiMediaScope
}): BangumiJobPreviewGroup {
  const subjectId = readCollectionSubjectId(collection)
  const subject = collection.subject
  const title = subject
    ? formatBangumiSubjectTitle(subject.name_cn, subject.name, subjectId)
    : `${subjectId}`
  const label = getMediaScopeLabel(scope)
  const rows: BangumiJobPreviewRow[] = [
    { label, before: '不存在', after: '创建', tone: 'success' },
    { label: 'Bangumi ID', before: '无', after: `${subjectId}`, tone: 'success' }
  ]

  if (fields.status) {
    rows.push({
      label: '状态',
      before: '未设置',
      after: formatLocalStatus(mapCollectionTypeToLocalStatus(collection.type)),
      tone: 'success'
    })
  }

  if (fields.score) {
    rows.push({
      label: '评分',
      before: '未评分',
      after: formatCollectionScore(collection.rate),
      tone: 'success'
    })
  }

  if (fields.tags) {
    rows.push({
      label: '标签',
      before: '无',
      after: formatCollectionTags(collection.tags),
      tone: 'success'
    })
  }

  if (targetCollection) {
    rows.push({
      label: '合集',
      before: '未加入',
      after: formatTargetCollectionValue(targetCollection),
      tone: 'success'
    })
  }

  return createPreviewGroup({
    title,
    subjectId,
    badge: { label: `创建本地${label}`, tone: 'success' },
    rows
  })
}

function createImportCollectionPatchPreviewChangeFromPlan({
  item,
  collection,
  updatePlan,
  scope
}: {
  item: LocalMediaItem
  collection: BangumiUserCollection
  updatePlan: CollectionLocalUpdatePlan
  scope: BangumiMediaScope
}): BangumiJobPreviewGroup {
  const subjectId = readCollectionSubjectId(collection)

  return createPreviewGroup({
    title: item.name,
    subjectId,
    badge: { label: `更新本地${getMediaScopeLabel(scope)}`, tone: 'info' },
    rows: updatePlan.rows
  })
}

function createIndexCreatePreviewChange(
  subject: BangumiIndexSubject,
  targetCollection: LocalCollectionTarget | undefined,
  scope: BangumiMediaScope
): BangumiJobPreviewGroup {
  const subjectId =
    typeof subject.id === 'number' && subject.id > 0 ? Math.trunc(subject.id) : subject.id
  const title = formatBangumiSubjectTitle(subject.name_cn, subject.name, subjectId)
  const label = getMediaScopeLabel(scope)
  const rows: BangumiJobPreviewRow[] = [
    { label, before: '不存在', after: '创建', tone: 'success' },
    { label: 'Bangumi ID', before: '无', after: `${subjectId}`, tone: 'success' }
  ]

  if (targetCollection) {
    rows.push({
      label: '合集',
      before: '未加入',
      after: formatTargetCollectionValue(targetCollection),
      tone: 'success'
    })
  }

  return createPreviewGroup({
    title,
    subjectId,
    badge: { label: `创建本地${label}`, tone: 'success' },
    rows
  })
}

function reportCollectionImportPreviewStart(job: JobStateController, total: number): void {
  if (total <= 0) {
    return
  }

  job.report('planningCollectionImport', '正在生成收藏导入预览...', {
    current: 0,
    total,
    ratePeriod: 'second'
  })
}

function reportIndexImportPreviewStart(job: JobStateController, total: number): void {
  if (total <= 0) {
    return
  }

  job.report('planningIndexImport', '正在生成目录导入预览...', {
    current: 0,
    total,
    ratePeriod: 'second'
  })
}
