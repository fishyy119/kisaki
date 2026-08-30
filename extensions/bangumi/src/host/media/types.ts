import type { Disposable, LibraryMediaStatus, ScraperProfileSummary } from '@kisaki3/extension-sdk'
import type { BangumiMediaScope, BangumiSupportedSubjectType } from '../../shared/scopes'

export interface ExternalIdRef {
  source: string
  id: string
}

/**
 * Read-unit progress of a book entry, as counts of finished units.
 *
 * Bangumi tracks book progress as two integers on the collection
 * (`vol_status` / `ep_status`); adapters that own per-unit read state report
 * the matching counts here.
 */
export interface LocalUnitProgress {
  volumes?: number
  chapters?: number
}

/**
 * Units the entry actually holds, per grain.
 *
 * An entry can be tracked on Bangumi long before its unit rows exist locally,
 * so adoption is capped by this: an import must not report progress it has no
 * row to record.
 */
export interface LocalUnitCapacity {
  volumes: number
  chapters: number
}

export interface LocalMediaItem {
  scope: BangumiMediaScope
  localId: string
  name: string
  status?: LibraryMediaStatus | undefined
  score?: number | null | undefined
  externalIds: readonly ExternalIdRef[]
  /** Present for scopes that push unit progress with the collection payload. */
  unitProgress?: LocalUnitProgress | undefined
}

export interface LocalMediaListQuery {
  includeNsfw?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export type LocalMediaChangeReason = 'created' | 'updated' | 'episodes' | 'manual'

export interface LocalMediaChangeEvent {
  scope: BangumiMediaScope
  localId: string
  reason: LocalMediaChangeReason
}

export type LocalMediaChangeListener = (event: LocalMediaChangeEvent) => void | Promise<void>

/**
 * What the Bangumi entry states about itself, in Bangumi's own wording.
 *
 * Each scope's adapter maps the wording its media type can use into scraper
 * lookup facts, so a provider that has no Bangumi id for the entry can still
 * tell it apart from the rest of the work. Bangumi surfaces that list only ids
 * and names, such as index entries, state nothing here.
 */
export interface BangumiSubjectFacts {
  date?: string | undefined
  platform?: string | undefined
}

export interface LocalMediaAddFromScraperInput {
  profileId: string
  name: string
  knownIds: readonly ExternalIdRef[]
  facts?: BangumiSubjectFacts
}

export interface LocalMediaAddResult {
  localId: string
  isNew: boolean
}

export interface LocalMediaUserPatch {
  status?: LibraryMediaStatus
  score?: number | null
}

/**
 * Watch state of one episode owned by a local entry.
 *
 * Only the binary watched flag travels: Bangumi's per-episode wish/dropped
 * states have no local counterpart.
 */
export interface LocalEpisodeItem {
  localId: string
  watched: boolean
  externalIds: readonly ExternalIdRef[]
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
  readonly supportsScraperProfile: boolean
  readonly supportsAutoSync: boolean
  readonly supportsImportWrite: boolean
  /**
   * Set when the scope pushes per-unit progress: episode watch state for
   * anime, finished volume and chapter counts for books.
   */
  readonly supportsUnitProgress?: boolean
  listProfiles?(): Promise<readonly ScraperProfileSummary[]>
  listEpisodes?(localId: string): Promise<readonly LocalEpisodeItem[]>
  subscribeLocalChanges?(listener: LocalMediaChangeListener): Promise<Disposable>
  listLocalItems(query: LocalMediaListQuery): Promise<readonly LocalMediaItem[]>
  getLocalItem(localId: string): Promise<LocalMediaItem | null>
  findBySubjectIds(subjectIds: readonly string[]): Promise<ReadonlyMap<string, LocalMediaItem>>
  addFromScraper(input: LocalMediaAddFromScraperInput): Promise<LocalMediaAddResult>
  patchUserFields(localId: string, patch: LocalMediaUserPatch): Promise<LocalMediaItem>
  /**
   * Adopts remote unit progress locally by marking the first N units read, in
   * unit order. Only marks forward: local read state is never cleared here.
   */
  applyUnitProgress?(localId: string, progress: LocalUnitProgress): Promise<void>
  /** Units available to mark, paired with `applyUnitProgress`. */
  readUnitCapacity?(localId: string): Promise<LocalUnitCapacity>
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
  localAdapter?: LocalMediaAdapter | undefined
}

/** Scopes backed by a local library adapter; every other scope is remote-only. */
export const LOCAL_MEDIA_SCOPES = ['game', 'anime', 'book'] as const

export type LocalMediaScope = (typeof LOCAL_MEDIA_SCOPES)[number]

export interface RemoteOnlyMediaDescriptor extends BangumiMediaDescriptor {
  scope: Exclude<BangumiMediaScope, LocalMediaScope>
  localAdapter?: undefined
}
