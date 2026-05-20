import type { Disposable, ScraperProfileSummary } from '@kisaki/extension-sdk'
import type { BangumiCollectionType } from '../api/types'
import type { BangumiMediaScope, BangumiSupportedSubjectType } from './scopes'

export interface ExternalIdRef {
  source: string
  id: string
}

export interface LocalMediaItem {
  scope: BangumiMediaScope
  localId: string
  name: string
  status?: string
  score?: number | null
  externalIds: readonly ExternalIdRef[]
}

export interface LocalMediaListQuery {
  includeNsfw?: boolean
  limit?: number
  offset?: number
}

export type LocalMediaChangeReason = 'created' | 'updated' | 'manual'

export interface LocalMediaChangeEvent {
  scope: BangumiMediaScope
  localId: string
  reason: LocalMediaChangeReason
}

export type LocalMediaChangeListener = (
  event: LocalMediaChangeEvent
) => void | Promise<void>

export interface LocalMediaAddFromScraperInput {
  profileId: string
  name: string
  knownIds: readonly ExternalIdRef[]
}

export interface LocalMediaAddResult {
  localId: string
  isNew: boolean
}

export interface LocalMediaUserPatch {
  status?: string
  score?: number | null
}

export interface LocalCollectionSummary {
  id: string
  name: string
  description?: string
}

export interface LocalCollectionTarget {
  id?: string
  name: string
  willCreate?: boolean
}

export interface LocalMediaAdapter {
  readonly scope: BangumiMediaScope
  readonly localMediaType: string
  readonly supportsScraperProfile: boolean
  readonly supportsAutoSync: boolean
  readonly supportsImportWrite: boolean
  listProfiles?(): Promise<readonly ScraperProfileSummary[]>
  subscribeLocalChanges?(listener: LocalMediaChangeListener): Promise<Disposable>
  listLocalItems(query: LocalMediaListQuery): Promise<readonly LocalMediaItem[]>
  getLocalItem(localId: string): Promise<LocalMediaItem | null>
  findBySubjectIds(subjectIds: readonly string[]): Promise<ReadonlyMap<string, LocalMediaItem>>
  addFromScraper(input: LocalMediaAddFromScraperInput): Promise<LocalMediaAddResult>
  patchUserFields(localId: string, patch: LocalMediaUserPatch): Promise<LocalMediaItem>
  listTagNames?(localId: string): Promise<ReadonlySet<string>>
  ensureTag(localId: string, tagName: string): Promise<void>
  listCollections?(): Promise<readonly LocalCollectionSummary[]>
  resolveExistingCollection?(collectionId: string): Promise<LocalCollectionTarget>
  resolveCollectionByTitle?(title: string): Promise<LocalCollectionTarget>
  hasCollectionMembership?(localId: string, target: LocalCollectionTarget): Promise<boolean>
  ensureInCollection(localId: string, target: LocalCollectionTarget): Promise<void>
}

export interface BangumiMediaDescriptor {
  scope: BangumiMediaScope
  subjectType: BangumiSupportedSubjectType
  label: string
  collectionLabels: Record<BangumiCollectionType, string>
  localAdapter?: LocalMediaAdapter
}

export interface RemoteOnlyMediaDescriptor extends BangumiMediaDescriptor {
  scope: Exclude<BangumiMediaScope, 'game'>
  localAdapter?: undefined
}
