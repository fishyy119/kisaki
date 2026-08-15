import type { BangumiIndexSubject, BangumiUserCollection } from '../../api/types'
import type { BangumiCollectionType } from '../../config/schema'
import type { ImportExecutor } from '../../import/executor'
import type { BangumiMediaScope } from '../../../shared/scopes'
import type {
  LocalCollectionTarget,
  LocalMediaAdapter,
  LocalMediaItem,
  LocalMediaUserPatch
} from '../../media/types'
import { BANGUMI_SOURCE_ID } from '../../utils/constants'
import { BangumiExtensionError } from '../../utils/errors'
import { m } from '../../i18n'
import { omitUndefined } from '../../utils/object'
import type { BangumiImportCollectionsArgs, BangumiImportTargetCollection } from '../args'
import type { CollectionLocalUpdatePlan } from './model'
import { formatBangumiSubjectTitle } from '../presentation'
import type { BangumiJobPreviewRow } from '../../../shared/settings'

export async function resolveTargetCollection(
  adapter: LocalMediaAdapter,
  targetCollection: BangumiImportTargetCollection
): Promise<LocalCollectionTarget | undefined> {
  if (targetCollection.kind !== 'existing') {
    return undefined
  }

  return adapter.resolveExistingCollection?.(targetCollection.collectionId)
}

export async function resolveIndexTargetCollection(
  adapter: LocalMediaAdapter,
  targetCollection: BangumiImportTargetCollection,
  indexTitle: string
): Promise<LocalCollectionTarget | undefined> {
  if (targetCollection.kind === 'byIndexTitle') {
    return adapter.resolveCollectionByTitle?.(indexTitle)
  }

  return resolveTargetCollection(adapter, targetCollection)
}

export async function importItemFromCollection(
  executor: ImportExecutor,
  scope: BangumiMediaScope,
  profileId: string | undefined,
  collection: BangumiUserCollection
) {
  const subjectId = readCollectionSubjectId(collection)
  const subject = collection.subject
  const title = subject
    ? formatBangumiSubjectTitle(subject.name_cn, subject.name, subjectId)
    : `Bangumi ${subjectId}`

  return executor.addFromScraper(scope, {
    profileId: requireProfileId(profileId),
    name: title,
    knownIds: [{ source: BANGUMI_SOURCE_ID, id: String(subjectId) }],
    facts: omitUndefined({ date: subject?.date, platform: subject?.platform })
  })
}

export async function importItemFromIndexSubject(
  executor: ImportExecutor,
  scope: BangumiMediaScope,
  profileId: string | undefined,
  subject: BangumiIndexSubject
) {
  const subjectId = normalizePositiveInteger(subject.id)
  if (!subjectId) {
    throw new BangumiExtensionError('bangumi_validation', m().errors.indexSubjectMissingId)
  }

  return executor.addFromScraper(scope, {
    profileId: requireProfileId(profileId),
    name: formatBangumiSubjectTitle(subject.name_cn, subject.name, subjectId),
    knownIds: [{ source: BANGUMI_SOURCE_ID, id: String(subjectId) }]
  })
}

export async function requireLocalItem(
  adapter: LocalMediaAdapter,
  localId: string
): Promise<LocalMediaItem> {
  const item = await adapter.getLocalItem(localId)
  if (!item) {
    throw new BangumiExtensionError('library_update_failed', m().errors.importedItemMissing)
  }
  return item
}

export async function applyCollectionLocalUpdate({
  adapter,
  executor,
  scope,
  item,
  collection,
  fields,
  targetCollection
}: {
  adapter: LocalMediaAdapter
  executor: ImportExecutor
  scope: BangumiMediaScope
  item: LocalMediaItem
  collection: BangumiUserCollection
  fields: BangumiImportCollectionsArgs['fields']
  targetCollection: LocalCollectionTarget | undefined
}): Promise<void> {
  const plan = await buildCollectionLocalUpdatePlan({
    adapter,
    item,
    collection,
    fields,
    targetCollection
  })

  await applyCollectionLocalUpdatePlan({ executor, scope, item, plan })
}

export async function applyCollectionLocalUpdatePlan({
  executor,
  scope,
  item,
  plan
}: {
  executor: ImportExecutor
  scope: BangumiMediaScope
  item: LocalMediaItem
  plan: CollectionLocalUpdatePlan
}): Promise<void> {
  if (Object.keys(plan.patch).length > 0) {
    await executor.patchUserFields(scope, item.localId, plan.patch)
  }

  for (const tagName of plan.tagNames) {
    await executor.ensureTag(scope, item.localId, tagName)
  }

  if (plan.targetCollection) {
    await executor.ensureInCollection(scope, item.localId, plan.targetCollection)
  }
}

export async function buildCollectionLocalUpdatePlan({
  adapter,
  item,
  collection,
  fields,
  targetCollection
}: {
  adapter: LocalMediaAdapter
  item: LocalMediaItem
  collection: BangumiUserCollection
  fields: BangumiImportCollectionsArgs['fields']
  targetCollection: LocalCollectionTarget | undefined
}): Promise<CollectionLocalUpdatePlan> {
  const patch: LocalMediaUserPatch = {}
  const rows: BangumiJobPreviewRow[] = []
  let tagNames: readonly string[] = []
  let resolvedTargetCollection: LocalCollectionTarget | undefined

  if (fields.status) {
    const targetStatus = mapCollectionTypeToLocalStatus(item.scope, collection.type)
    if (item.status !== targetStatus) {
      patch.status = targetStatus
      rows.push({
        label: m().jobs.preview.status,
        before: formatLocalStatus(item.scope, item.status),
        after: formatLocalStatus(item.scope, targetStatus),
        tone: 'info'
      })
    }
  }

  if (fields.score) {
    const localScore = normalizeLocalScore(item.score)
    const targetScore = normalizeCollectionScoreForImport(collection.rate)
    if (localScore !== targetScore) {
      patch.score = targetScore
      rows.push({
        label: m().jobs.preview.score,
        before: formatLocalScore(localScore),
        after: formatLocalScore(targetScore),
        tone: 'info'
      })
    }
  }

  if (fields.tags) {
    const targetTagNames = normalizeCollectionTagNames(collection.tags)
    const currentTagNames = (await adapter.listTagNames?.(item.localId)) ?? new Set<string>()
    const missingTags = targetTagNames.filter((tagName) => !currentTagNames.has(tagName))
    if (missingTags.length > 0) {
      tagNames = missingTags
      rows.push({
        label: m().jobs.preview.tags,
        before: formatTagNames([...currentTagNames]),
        after: formatTagNames(targetTagNames),
        tone: 'info'
      })
    }
  }

  const hasTargetCollectionRelation = targetCollection
    ? ((await adapter.hasCollectionMembership?.(item.localId, targetCollection)) ?? false)
    : false
  if (targetCollection && !hasTargetCollectionRelation) {
    resolvedTargetCollection = targetCollection
    rows.push({
      label: m().jobs.preview.collection,
      before: m().jobs.preview.notInCollection,
      after: formatTargetCollectionValue(targetCollection),
      tone: 'success'
    })
  }

  return omitUndefined({
    patch,
    tagNames,
    targetCollection: resolvedTargetCollection,
    rows
  })
}

export function hasCollectionLocalChanges(plan: CollectionLocalUpdatePlan): boolean {
  return (
    Object.keys(plan.patch).length > 0 ||
    plan.tagNames.length > 0 ||
    plan.targetCollection !== undefined ||
    plan.rows.length > 0
  )
}

export function readCollectionSubjectId(collection: BangumiUserCollection): number {
  return (
    normalizePositiveInteger(collection.subject_id) ??
    normalizePositiveInteger(collection.subject?.id) ??
    0
  )
}

export function normalizePositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : undefined
}

export function formatTargetCollectionValue(targetCollection: LocalCollectionTarget): string {
  return targetCollection.name
}

export function formatCollectionScore(score: number | undefined): string {
  return formatLocalScore(normalizeCollectionScoreForImport(score))
}

export function formatCollectionTags(tags: readonly string[] | undefined): string {
  const normalized = (tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0)
  return normalized.length > 0 ? normalized.join(m().common.listSeparator) : m().common.none
}

export function formatLocalStatus(scope: BangumiMediaScope, value: string | undefined): string {
  if (scope === 'anime') {
    const labels = m().jobs.animeStatus
    switch (value) {
      case 'planned':
        return labels.planned
      case 'watching':
        return labels.watching
      case 'completed':
        return labels.completed
      case 'onHold':
        return labels.onHold
      case 'dropped':
        return labels.dropped
      default:
        return labels.unset
    }
  }

  const labels = m().jobs.gameStatus
  switch (value) {
    case 'notStarted':
      return labels.notStarted
    case 'inProgress':
      return labels.inProgress
    case 'partial':
      return labels.partial
    case 'completed':
      return labels.completed
    case 'multiple':
      return labels.multiple
    case 'shelved':
      return labels.shelved
    default:
      return labels.unset
  }
}

const GAME_STATUS_BY_COLLECTION_TYPE: Record<BangumiCollectionType, string> = {
  1: 'notStarted',
  2: 'completed',
  3: 'inProgress',
  4: 'shelved',
  5: 'shelved'
}

const ANIME_STATUS_BY_COLLECTION_TYPE: Record<BangumiCollectionType, string> = {
  1: 'planned',
  2: 'completed',
  3: 'watching',
  4: 'onHold',
  5: 'dropped'
}

export function mapCollectionTypeToLocalStatus(
  scope: BangumiMediaScope,
  type: BangumiCollectionType
): string {
  const table = scope === 'anime' ? ANIME_STATUS_BY_COLLECTION_TYPE : GAME_STATUS_BY_COLLECTION_TYPE
  return table[type]
}

function normalizeBangumiRate(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(10, Math.max(1, Math.trunc(value)))
    : undefined
}

function normalizeLocalScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeCollectionScoreForImport(value: unknown): number | null {
  const rate = normalizeBangumiRate(value)
  return rate === undefined ? null : rate * 10
}

function normalizeCollectionTagNames(tags: readonly string[] | undefined): readonly string[] {
  const names: string[] = []
  const seen = new Set<string>()

  for (const tag of tags ?? []) {
    const name = tag.trim()
    if (name && !seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  }

  return names
}

function formatLocalScore(score: number | null): string {
  return score === null ? m().jobs.preview.notRated : (score / 10).toFixed(1)
}

function formatTagNames(tagNames: readonly string[]): string {
  return tagNames.length > 0 ? tagNames.join(m().common.listSeparator) : m().common.none
}

function requireProfileId(profileId: string | undefined): string {
  const normalized = profileId?.trim()
  if (!normalized) {
    throw new BangumiExtensionError('profile_missing', m().errors.profileRequired)
  }
  return normalized
}
