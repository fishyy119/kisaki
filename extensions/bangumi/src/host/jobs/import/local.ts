import type { LibraryMediaStatus } from '@kisaki3/extension-sdk'
import type { BangumiIndexSubject, BangumiUserCollection } from '../../api/types'
import type { BangumiCollectionType } from '../../config/schema'
import type { ImportExecutor } from '../../import/executor'
import type { BangumiMediaScope } from '../../../shared/scopes'
import type {
  LocalCollectionTarget,
  LocalMediaAdapter,
  LocalMediaItem,
  LocalMediaUserPatch,
  LocalUnitCapacity,
  LocalUnitProgress
} from '../../media/types'
import { BANGUMI_SOURCE_ID } from '../../utils/constants'
import { BangumiExtensionError } from '../../utils/errors'
import { m } from '../../i18n'
import { readPositiveInteger } from '../../utils/numbers'
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
  const subjectId = readPositiveInteger(subject.id)
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

  if (plan.unitProgress) {
    await executor.applyUnitProgress(scope, item.localId, plan.unitProgress)
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
    const targetStatus = mapCollectionTypeToLocalStatus(collection.type)
    if (item.status !== targetStatus) {
      patch.status = targetStatus
      rows.push({
        label: m().jobs.preview.status,
        before: formatLocalStatus(item.status),
        after: formatLocalStatus(targetStatus),
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

  const unitProgress =
    fields.unitProgress && adapter.applyUnitProgress && adapter.readUnitCapacity
      ? planUnitProgressAdoption(item, collection, await adapter.readUnitCapacity(item.localId))
      : undefined
  if (unitProgress) {
    rows.push({
      label: m().jobs.preview.unitProgress,
      before: formatUnitProgress(item.unitProgress),
      after: formatUnitProgress(mergeUnitProgress(item.unitProgress, unitProgress)),
      tone: 'info'
    })
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
    unitProgress,
    rows
  })
}

/**
 * Remote unit counts worth adopting: only the dimensions where Bangumi is
 * ahead of the local read state, so imports never regress local progress.
 *
 * Adoption marks existing unit rows, so it is capped by how many the entry
 * has. An entry Bangumi tracks but the library has no units for adopts
 * nothing, and the preview says so by omitting the row.
 */
function planUnitProgressAdoption(
  item: LocalMediaItem,
  collection: BangumiUserCollection,
  capacity: LocalUnitCapacity
): LocalUnitProgress | undefined {
  const progress: LocalUnitProgress = {}

  const volumes = planGrainAdoption(
    collection.vol_status,
    item.unitProgress?.volumes ?? 0,
    capacity.volumes
  )
  if (volumes !== undefined) progress.volumes = volumes

  const chapters = planGrainAdoption(
    collection.ep_status,
    item.unitProgress?.chapters ?? 0,
    capacity.chapters
  )
  if (chapters !== undefined) progress.chapters = chapters

  return progress.volumes !== undefined || progress.chapters !== undefined ? progress : undefined
}

function planGrainAdoption(remote: unknown, local: number, capacity: number): number | undefined {
  const remoteCount = readPositiveInteger(remote)
  if (remoteCount === undefined || capacity <= 0) return undefined

  const adoptable = Math.min(remoteCount, capacity)
  return adoptable > local ? adoptable : undefined
}

function mergeUnitProgress(
  current: LocalUnitProgress | undefined,
  adopted: LocalUnitProgress
): LocalUnitProgress {
  return {
    volumes: adopted.volumes ?? current?.volumes ?? 0,
    chapters: adopted.chapters ?? current?.chapters ?? 0
  }
}

function formatUnitProgress(progress: LocalUnitProgress | undefined): string {
  return m().jobs.preview.unitProgressValue({
    volumes: progress?.volumes ?? 0,
    chapters: progress?.chapters ?? 0
  })
}

export function hasCollectionLocalChanges(plan: CollectionLocalUpdatePlan): boolean {
  return (
    Object.keys(plan.patch).length > 0 ||
    plan.tagNames.length > 0 ||
    plan.targetCollection !== undefined ||
    plan.unitProgress !== undefined ||
    plan.rows.length > 0
  )
}

export function readCollectionSubjectId(collection: BangumiUserCollection): number {
  return (
    readPositiveInteger(collection.subject_id) ?? readPositiveInteger(collection.subject?.id) ?? 0
  )
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

export function formatLocalStatus(value: LibraryMediaStatus | undefined): string {
  const labels = m().jobs.status
  return value === undefined ? labels.unset : labels[value]
}

/** One-to-one against Bangumi's wish/collect/do/on-hold/dropped types. */
const STATUS_BY_COLLECTION_TYPE: Record<BangumiCollectionType, LibraryMediaStatus> = {
  1: 'planned',
  2: 'completed',
  3: 'active',
  4: 'onHold',
  5: 'dropped'
}

export function mapCollectionTypeToLocalStatus(type: BangumiCollectionType): LibraryMediaStatus {
  return STATUS_BY_COLLECTION_TYPE[type]
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
