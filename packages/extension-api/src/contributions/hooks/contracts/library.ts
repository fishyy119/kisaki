import type {
  DynamicCollectionConfig,
  LibraryComicReadingDirection,
  LibraryMediaStatus,
  LibraryMediaType
} from '../../../capabilities/library'
import type {
  ExternalId,
  LibraryAnimeFormat,
  LibraryBloodType,
  LibraryComicFormat,
  LibraryCupSize,
  LibraryGender,
  LibraryMediaRelationType,
  LibraryNovelFormat,
  PartialDate,
  ExternalSite
} from '../../../shared'
import type { HookPointSpec } from './point'

export type LibraryEntityTopic =
  'game' | 'anime' | 'comic' | 'novel' | 'person' | 'company' | 'character' | 'collection' | 'tag'

export type LibraryChangeKind = 'created' | 'updated' | 'deleted'

export interface LibraryGameCoreSnapshot {
  name?: string
  originalName?: string | null
  aliases?: readonly string[]
  description?: string | null
  releaseDate?: PartialDate | null
}

export interface LibraryAnimeCoreSnapshot {
  name?: string
  originalName?: string | null
  aliases?: readonly string[]
  description?: string | null
  releaseDate?: PartialDate | null
  format?: LibraryAnimeFormat
  totalEpisodes?: number | null
}

export interface LibraryComicCoreSnapshot {
  name?: string
  originalName?: string | null
  aliases?: readonly string[]
  description?: string | null
  releaseDate?: PartialDate | null
  format?: LibraryComicFormat
  readingDirection?: LibraryComicReadingDirection | null
  totalVolumes?: number | null
  totalChapters?: number | null
}

export interface LibraryNovelCoreSnapshot {
  name?: string
  originalName?: string | null
  aliases?: readonly string[]
  description?: string | null
  releaseDate?: PartialDate | null
  format?: LibraryNovelFormat
  totalVolumes?: number | null
}

export interface LibraryGameAssetSnapshot {
  coverFile?: string | null
  backdropFile?: string | null
  logoFile?: string | null
  iconFile?: string | null
}

export interface LibraryAnimeAssetSnapshot {
  coverFile?: string | null
  backdropFile?: string | null
  logoFile?: string | null
}

export interface LibraryComicAssetSnapshot {
  coverFile?: string | null
  backdropFile?: string | null
  logoFile?: string | null
}

export interface LibraryNovelAssetSnapshot {
  coverFile?: string | null
  backdropFile?: string | null
  logoFile?: string | null
}

/** Consumption counters shared by every media type that tracks consumption. */
export interface LibraryMediaActivitySnapshot {
  totalDuration?: number
  lastActiveAt?: number | null
}

/** Satellite links every media type owns. */
/** Satellite links every media type owns. */
export interface LibraryMediaLinkSnapshot {
  personLinkIds: readonly string[]
  companyLinkIds: readonly string[]
  characterLinkIds: readonly string[]
}

/**
 * Link snapshot of a media type that credits voice actors.
 *
 * Print media has no audio track, so comics and novels never carry cast rows
 * and their snapshot omits the field rather than reporting a constant empty
 * set.
 */
export interface LibraryCastMediaLinkSnapshot extends LibraryMediaLinkSnapshot {
  castLinkIds: readonly string[]
}

/** One outgoing entry-to-entry edge as seen from the changed entity. */
export interface LibraryMediaRelationEdge {
  toType: LibraryMediaType
  toId: string
  type: LibraryMediaRelationType
}

export interface LibraryMediaRelationsSnapshot {
  relations: readonly LibraryMediaRelationEdge[]
}

export interface LibraryPersonCoreSnapshot {
  name?: string
  originalName?: string | null
  sortName?: string | null
  aliases?: readonly string[]
  description?: string | null
  isFavorite?: boolean
  isNsfw?: boolean
  birthDate?: PartialDate | null
  deathDate?: PartialDate | null
  gender?: LibraryGender | null
  externalSites?: readonly ExternalSite[]
}

export interface LibraryCompanyCoreSnapshot {
  name?: string
  originalName?: string | null
  sortName?: string | null
  description?: string | null
  isFavorite?: boolean
  isNsfw?: boolean
  foundedDate?: PartialDate | null
  externalSites?: readonly ExternalSite[]
}

export interface LibraryCharacterCoreSnapshot {
  name?: string
  originalName?: string | null
  sortName?: string | null
  aliases?: readonly string[]
  description?: string | null
  isFavorite?: boolean
  isNsfw?: boolean
  birthDate?: PartialDate | null
  gender?: LibraryGender | null
  bloodType?: LibraryBloodType | null
  height?: number | null
  weight?: number | null
  bust?: number | null
  waist?: number | null
  hips?: number | null
  cup?: LibraryCupSize | null
  age?: number | null
  externalSites?: readonly ExternalSite[]
}

export interface LibraryCollectionCoreSnapshot {
  name?: string
  description?: string | null
  isNsfw?: boolean
  order?: number
}

export interface LibraryCollectionDynamicConfigSnapshot {
  isDynamic?: boolean
  dynamicConfig?: DynamicCollectionConfig | null
}

export interface LibraryTagCoreSnapshot {
  name?: string
  description?: string | null
  isNsfw?: boolean
}

export interface LibraryPersonAssetSnapshot {
  photoFile?: string | null
}

export interface LibraryCompanyAssetSnapshot {
  logoFile?: string | null
}

export interface LibraryCharacterAssetSnapshot {
  photoFile?: string | null
}

export interface LibraryCollectionAssetSnapshot {
  coverFile?: string | null
}

export interface LibraryCollectionMembershipSnapshot {
  gameIds?: readonly string[]
  animeIds?: readonly string[]
  comicIds?: readonly string[]
  novelIds?: readonly string[]
  personIds?: readonly string[]
  companyIds?: readonly string[]
  characterIds?: readonly string[]
}

export type LibraryCoreChange<TSnapshot extends object> = {
  facet: 'core'
  before: Partial<TSnapshot>
  after: Partial<TSnapshot>
  fields?: readonly string[]
}

export type LibraryScoreChange = {
  facet: 'score'
  before: { score: number | null }
  after: { score: number | null }
  fields?: readonly ['score']
}

export type LibraryIdentityChange = {
  facet: 'identity'
  before: { externalIds: readonly ExternalId[] }
  after: { externalIds: readonly ExternalId[] }
  fields?: readonly string[]
}

export type LibraryTagsChange = {
  facet: 'tags'
  before: { tagIds: readonly string[] }
  after: { tagIds: readonly string[] }
  fields?: readonly string[]
}

export type LibraryAssetChange<TSnapshot extends object> = {
  facet: 'assets'
  before: Partial<TSnapshot>
  after: Partial<TSnapshot>
  fields?: readonly string[]
}

export type LibraryLinksChange<TSnapshot extends object> = {
  facet: 'links'
  before: TSnapshot
  after: TSnapshot
  fields?: readonly string[]
}

export type LibraryRelationsChange<TSnapshot extends object> = {
  facet: 'relations'
  before: TSnapshot
  after: TSnapshot
  fields?: readonly string[]
}

export type LibraryMembershipChange<TSnapshot extends object> = {
  facet: 'membership'
  before: TSnapshot
  after: TSnapshot
  fields?: readonly string[]
}

export type LibraryDynamicConfigChange = {
  facet: 'dynamicConfig'
  before: Partial<LibraryCollectionDynamicConfigSnapshot>
  after: Partial<LibraryCollectionDynamicConfigSnapshot>
  fields?: readonly string[]
}

export type LibraryStatusChange = {
  facet: 'status'
  before: { status: LibraryMediaStatus }
  after: { status: LibraryMediaStatus }
  fields?: readonly ['status']
}

export type LibraryActivityChange = {
  facet: 'activity'
  before: LibraryMediaActivitySnapshot
  after: LibraryMediaActivitySnapshot
  fields?: readonly string[]
}

export type LibraryCollectionsChange = {
  facet: 'collections'
  before: { collectionIds: readonly string[] }
  after: { collectionIds: readonly string[] }
  fields?: readonly string[]
}

/**
 * Watch-state transitions of an entry's episodes.
 *
 * Only the watched set is carried: resume positions and play counts churn
 * during playback and would turn the feed into a progress stream.
 */
export type LibraryEpisodesChange = {
  facet: 'episodes'
  before: { watchedEpisodeIds: readonly string[] }
  after: { watchedEpisodeIds: readonly string[] }
  fields?: readonly ['watchedEpisodeIds']
}

/**
 * Read-state transitions of an entry's readable units (comic chapters, novel
 * volumes). Mirrors {@link LibraryEpisodesChange}: only the read set travels,
 * resume positions churn during reading and stay out of the feed.
 */
export type LibraryUnitsChange = {
  facet: 'units'
  before: { readUnitIds: readonly string[] }
  after: { readUnitIds: readonly string[] }
  fields?: readonly ['readUnitIds']
}

export type LibraryGameChange =
  | LibraryCoreChange<LibraryGameCoreSnapshot>
  | LibraryStatusChange
  | LibraryScoreChange
  | LibraryIdentityChange
  | LibraryActivityChange
  | LibraryTagsChange
  | LibraryCollectionsChange
  | LibraryAssetChange<LibraryGameAssetSnapshot>
  | LibraryLinksChange<LibraryCastMediaLinkSnapshot>
  | LibraryRelationsChange<LibraryMediaRelationsSnapshot>

export type LibraryAnimeChange =
  | LibraryCoreChange<LibraryAnimeCoreSnapshot>
  | LibraryStatusChange
  | LibraryScoreChange
  | LibraryIdentityChange
  | LibraryActivityChange
  | LibraryTagsChange
  | LibraryCollectionsChange
  | LibraryAssetChange<LibraryAnimeAssetSnapshot>
  | LibraryLinksChange<LibraryCastMediaLinkSnapshot>
  | LibraryRelationsChange<LibraryMediaRelationsSnapshot>
  | LibraryEpisodesChange

export type LibraryComicChange =
  | LibraryCoreChange<LibraryComicCoreSnapshot>
  | LibraryStatusChange
  | LibraryScoreChange
  | LibraryIdentityChange
  | LibraryActivityChange
  | LibraryTagsChange
  | LibraryCollectionsChange
  | LibraryAssetChange<LibraryComicAssetSnapshot>
  | LibraryLinksChange<LibraryMediaLinkSnapshot>
  | LibraryRelationsChange<LibraryMediaRelationsSnapshot>
  | LibraryUnitsChange

export type LibraryNovelChange =
  | LibraryCoreChange<LibraryNovelCoreSnapshot>
  | LibraryStatusChange
  | LibraryScoreChange
  | LibraryIdentityChange
  | LibraryActivityChange
  | LibraryTagsChange
  | LibraryCollectionsChange
  | LibraryAssetChange<LibraryNovelAssetSnapshot>
  | LibraryLinksChange<LibraryMediaLinkSnapshot>
  | LibraryRelationsChange<LibraryMediaRelationsSnapshot>
  | LibraryUnitsChange

export type LibraryPersonChange =
  | LibraryCoreChange<LibraryPersonCoreSnapshot>
  | LibraryScoreChange
  | LibraryIdentityChange
  | LibraryTagsChange
  | LibraryAssetChange<LibraryPersonAssetSnapshot>

export type LibraryCompanyChange =
  | LibraryCoreChange<LibraryCompanyCoreSnapshot>
  | LibraryScoreChange
  | LibraryIdentityChange
  | LibraryTagsChange
  | LibraryAssetChange<LibraryCompanyAssetSnapshot>

export type LibraryCharacterChange =
  | LibraryCoreChange<LibraryCharacterCoreSnapshot>
  | LibraryScoreChange
  | LibraryIdentityChange
  | LibraryTagsChange
  | LibraryAssetChange<LibraryCharacterAssetSnapshot>

export type LibraryCollectionChange =
  | LibraryCoreChange<LibraryCollectionCoreSnapshot>
  | LibraryAssetChange<LibraryCollectionAssetSnapshot>
  | LibraryDynamicConfigChange
  | LibraryMembershipChange<LibraryCollectionMembershipSnapshot>

export type LibraryTagChange = LibraryCoreChange<LibraryTagCoreSnapshot>

export type LibraryChange =
  | LibraryGameChange
  | LibraryAnimeChange
  | LibraryComicChange
  | LibraryNovelChange
  | LibraryPersonChange
  | LibraryCompanyChange
  | LibraryCharacterChange
  | LibraryCollectionChange
  | LibraryTagChange

/** One debounced, entity-grouped change carried by the `library.changed` point. */
export interface LibraryEntityChangeSummary {
  entity: LibraryEntityTopic
  id: string
  kind: LibraryChangeKind
  /** Present for created entities when a name is known. */
  name?: string
  /** Facet-level changes; present for updated entities. */
  changes?: readonly LibraryChange[]
  occurredAt: number
}

export interface LibraryChangedPayload {
  changes: readonly LibraryEntityChangeSummary[]
}

export interface LibraryEntityMergingPayload {
  entityType: LibraryEntityTopic
  targetId: string
  sourceId: string
}

export interface LibraryEntityMergedPayload {
  entityType: LibraryEntityTopic
  targetId: string
  sourceId: string
  occurredAt: number
}

/**
 * Library hook points.
 *
 * `library.changed` is a debounced, entity-grouped post-commit change feed;
 * `library.entity-merging` is a veto point before the merge transaction.
 */
export interface LibraryHookPoints {
  'library.changed': HookPointSpec<'notify', LibraryChangedPayload>
  'library.entity-merging': HookPointSpec<'veto', LibraryEntityMergingPayload>
  'library.entity-merged': HookPointSpec<'notify', LibraryEntityMergedPayload>
}
