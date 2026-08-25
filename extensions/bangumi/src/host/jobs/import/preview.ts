import type { BangumiIndexSubject, BangumiUserCollection } from '../../api/types'
import type { CollectionImportPlanItem, IndexImportPlanItem } from '../../import/planner'
import { formatScopedCollectionType, getMediaScopeLabel } from '../../media/labels'
import { m } from '../../i18n'
import type { BangumiMediaScope } from '../../../shared/scopes'
import type { LocalCollectionTarget, LocalMediaAdapter, LocalMediaItem } from '../../media/types'
import { BangumiExtensionError } from '../../utils/errors'
import { omitUndefined } from '../../utils/object'
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
import type { BangumiJobPreviewGroup, BangumiJobPreviewRow } from '../../../shared/settings'

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

    job.report('planningCollectionImport', m().jobs.import.buildingCollectionsPreview, {
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

    job.report('planningIndexImport', m().jobs.import.buildingIndexPreview, {
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
    badge: { label: m().jobs.preview.updateLocalBadge({ scope: adapter.scope }), tone: 'info' },
    rows: [
      {
        label: m().jobs.preview.collection,
        before: m().jobs.preview.notInCollection,
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
    job.report(
      'buildingRemoteCollectionPreview',
      m().jobs.import.buildingRemoteCollectionsPreview,
      {
        current: index + 1,
        total: planItems.length
      }
    )

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
            label: m().jobs.preview.collectionStatus,
            before: m().jobs.preview.remote,
            after: formatScopedCollectionType(scope, collection.type),
            tone: 'info'
          }
        ]
      })
    )
  }

  job.report('completed', m().jobs.import.remoteCollectionsPreviewCompleted({ scope }), {
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
    job.report('buildingRemoteIndexPreview', m().jobs.import.buildingRemoteIndexPreview, {
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
            before: m().jobs.preview.indexEntry,
            after: m().jobs.preview.remotePreview,
            tone: 'info'
          }
        ]
      })
    )
  }

  job.report('completed', m().jobs.import.remoteIndexPreviewCompleted({ scope }), {
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
    { label, before: m().jobs.preview.missing, after: m().jobs.preview.create, tone: 'success' },
    { label: 'Bangumi ID', before: m().common.none, after: `${subjectId}`, tone: 'success' }
  ]

  if (fields.status) {
    rows.push({
      label: m().jobs.preview.status,
      before: m().jobs.preview.notSet,
      after: formatLocalStatus(scope, mapCollectionTypeToLocalStatus(scope, collection.type)),
      tone: 'success'
    })
  }

  if (fields.score) {
    rows.push({
      label: m().jobs.preview.score,
      before: m().jobs.preview.notRated,
      after: formatCollectionScore(collection.rate),
      tone: 'success'
    })
  }

  if (fields.tags) {
    rows.push({
      label: m().jobs.preview.tags,
      before: m().common.none,
      after: formatCollectionTags(collection.tags),
      tone: 'success'
    })
  }

  if (targetCollection) {
    rows.push({
      label: m().jobs.preview.collection,
      before: m().jobs.preview.notInCollection,
      after: formatTargetCollectionValue(targetCollection),
      tone: 'success'
    })
  }

  return createPreviewGroup({
    title,
    subjectId,
    badge: { label: m().jobs.preview.createLocalBadge({ scope }), tone: 'success' },
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
    badge: { label: m().jobs.preview.updateLocalBadge({ scope }), tone: 'info' },
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
    { label, before: m().jobs.preview.missing, after: m().jobs.preview.create, tone: 'success' },
    { label: 'Bangumi ID', before: m().common.none, after: `${subjectId}`, tone: 'success' }
  ]

  if (targetCollection) {
    rows.push({
      label: m().jobs.preview.collection,
      before: m().jobs.preview.notInCollection,
      after: formatTargetCollectionValue(targetCollection),
      tone: 'success'
    })
  }

  return createPreviewGroup({
    title,
    subjectId,
    badge: { label: m().jobs.preview.createLocalBadge({ scope }), tone: 'success' },
    rows
  })
}

function reportCollectionImportPreviewStart(job: JobStateController, total: number): void {
  if (total <= 0) {
    return
  }

  job.report('planningCollectionImport', m().jobs.import.buildingCollectionsPreview, {
    current: 0,
    total,
    ratePeriod: 'second'
  })
}

function reportIndexImportPreviewStart(job: JobStateController, total: number): void {
  if (total <= 0) {
    return
  }

  job.report('planningIndexImport', m().jobs.import.buildingIndexPreview, {
    current: 0,
    total,
    ratePeriod: 'second'
  })
}
