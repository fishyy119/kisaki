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
  name?: string | undefined
  originalName?: string | null | undefined
  aliases?: readonly string[] | undefined
  description?: string | null | undefined
  releaseDate?: PartialDate | null | undefined
}

export interface LibraryAnimeCoreSnapshot {
  name?: string | undefined
  originalName?: string | null | undefined
  aliases?: readonly string[] | undefined
  description?: string | null | undefined
  releaseDate?: PartialDate | null | undefined
  format?: LibraryAnimeFormat | undefined
  totalEpisodes?: number | null | undefined
}

export interface LibraryComicCoreSnapshot {
  name?: string | undefined
  originalName?: string | null | undefined
  aliases?: readonly string[] | undefined
  description?: string | null | undefined
  releaseDate?: PartialDate | null | undefined
  format?: LibraryComicFormat | undefined
  readingDirection?: LibraryComicReadingDirection | null | undefined
  totalVolumes?: number | null | undefined
  totalChapters?: number | null | undefined
}

export interface LibraryNovelCoreSnapshot {
  name?: string | undefined
  originalName?: string | null | undefined
  aliases?: readonly string[] | undefined
  description?: string | null | undefined
  releaseDate?: PartialDate | null | undefined
  format?: LibraryNovelFormat | undefined
  totalVolumes?: number | null | undefined
}

export interface LibraryGameAssetSnapshot {
  coverFile?: string | null | undefined
  backdropFile?: string | null | undefined
  logoFile?: string | null | undefined
  iconFile?: string | null | undefined
}

export interface LibraryAnimeAssetSnapshot {
  coverFile?: string | null | undefined
  backdropFile?: string | null | undefined
  logoFile?: string | null | undefined
}

export interface LibraryComicAssetSnapshot {
  coverFile?: string | null | undefined
  backdropFile?: string | null | undefined
  logoFile?: string | null | undefined
}

export interface LibraryNovelAssetSnapshot {
  coverFile?: string | null | undefined
  backdropFile?: string | null | undefined
  logoFile?: string | null | undefined
}

/** Consumption counters shared by every media type that tracks consumption. */
export interface LibraryMediaActivitySnapshot {
  totalDuration?: number | undefined
  lastActiveAt?: number | null | undefined
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
  name?: string | undefined
  originalName?: string | null | undefined
  sortName?: string | null | undefined
  aliases?: readonly string[] | undefined
  description?: string | null | undefined
  isFavorite?: boolean | undefined
  isNsfw?: boolean | undefined
  birthDate?: PartialDate | null | undefined
  deathDate?: PartialDate | null | undefined
  gender?: LibraryGender | null | undefined
  externalSites?: readonly ExternalSite[] | undefined
}

export interface LibraryCompanyCoreSnapshot {
  name?: string | undefined
  originalName?: string | null | undefined
  sortName?: string | null | undefined
  description?: string | null | undefined
  isFavorite?: boolean | undefined
  isNsfw?: boolean | undefined
  foundedDate?: PartialDate | null | undefined
  externalSites?: readonly ExternalSite[] | undefined
}

export interface LibraryCharacterCoreSnapshot {
  name?: string | undefined
  originalName?: string | null | undefined
  sortName?: string | null | undefined
  aliases?: readonly string[] | undefined
  description?: string | null | undefined
  isFavorite?: boolean | undefined
  isNsfw?: boolean | undefined
  birthDate?: PartialDate | null | undefined
  gender?: LibraryGender | null | undefined
  bloodType?: LibraryBloodType | null | undefined
  height?: number | null | undefined
  weight?: number | null | undefined
  bust?: number | null | undefined
  waist?: number | null | undefined
  hips?: number | null | undefined
  cup?: LibraryCupSize | null | undefined
  age?: number | null | undefined
  externalSites?: readonly ExternalSite[] | undefined
}

export interface LibraryCollectionCoreSnapshot {
  name?: string | undefined
  description?: string | null | undefined
  isNsfw?: boolean | undefined
  order?: number | undefined
}

export interface LibraryCollectionDynamicConfigSnapshot {
  isDynamic?: boolean | undefined
  dynamicConfig?: DynamicCollectionConfig | null | undefined
}

export interface LibraryTagCoreSnapshot {
  name?: string | undefined
  description?: string | null | undefined
  isNsfw?: boolean | undefined
}

export interface LibraryPersonAssetSnapshot {
  photoFile?: string | null | undefined
}

export interface LibraryCompanyAssetSnapshot {
  logoFile?: string | null | undefined
}

export interface LibraryCharacterAssetSnapshot {
  photoFile?: string | null | undefined
}

export interface LibraryCollectionAssetSnapshot {
  coverFile?: string | null | undefined
}

export interface LibraryCollectionMembershipSnapshot {
  gameIds?: readonly string[] | undefined
  animeIds?: readonly string[] | undefined
  comicIds?: readonly string[] | undefined
  novelIds?: readonly string[] | undefined
  personIds?: readonly string[] | undefined
  companyIds?: readonly string[] | undefined
  characterIds?: readonly string[] | undefined
}

export type LibraryCoreChange<TSnapshot extends object> = {
  facet: 'core'
  before: Partial<TSnapshot>
  after: Partial<TSnapshot>
  fields?: readonly string[] | undefined
}

export type LibraryScoreChange = {
  facet: 'score'
  before: { score: number | null }
  after: { score: number | null }
  fields?: readonly ['score'] | undefined
}

export type LibraryIdentityChange = {
  facet: 'identity'
  before: { externalIds: readonly ExternalId[] }
  after: { externalIds: readonly ExternalId[] }
  fields?: readonly string[] | undefined
}

export type LibraryTagsChange = {
  facet: 'tags'
  before: { tagIds: readonly string[] }
  after: { tagIds: readonly string[] }
  fields?: readonly string[] | undefined
}

export type LibraryAssetChange<TSnapshot extends object> = {
  facet: 'assets'
  before: Partial<TSnapshot>
  after: Partial<TSnapshot>
  fields?: readonly string[] | undefined
}

export type LibraryLinksChange<TSnapshot extends object> = {
  facet: 'links'
  before: TSnapshot
  after: TSnapshot
  fields?: readonly string[] | undefined
}

export type LibraryRelationsChange<TSnapshot extends object> = {
  facet: 'relations'
  before: TSnapshot
  after: TSnapshot
  fields?: readonly string[] | undefined
}

export type LibraryMembershipChange<TSnapshot extends object> = {
  facet: 'membership'
  before: TSnapshot
  after: TSnapshot
  fields?: readonly string[] | undefined
}

export type LibraryDynamicConfigChange = {
  facet: 'dynamicConfig'
  before: Partial<LibraryCollectionDynamicConfigSnapshot>
  after: Partial<LibraryCollectionDynamicConfigSnapshot>
  fields?: readonly string[] | undefined
}

export type LibraryStatusChange = {
  facet: 'status'
  before: { status: LibraryMediaStatus }
  after: { status: LibraryMediaStatus }
  fields?: readonly ['status'] | undefined
}

export type LibraryActivityChange = {
  facet: 'activity'
  before: LibraryMediaActivitySnapshot
  after: LibraryMediaActivitySnapshot
  fields?: readonly string[] | undefined
}

export type LibraryCollectionsChange = {
  facet: 'collections'
  before: { collectionIds: readonly string[] }
  after: { collectionIds: readonly string[] }
  fields?: readonly string[] | undefined
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
  fields?: readonly ['watchedEpisodeIds'] | undefined
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
  fields?: readonly ['readUnitIds'] | undefined
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
  name?: string | undefined
  /** Facet-level changes; present for updated entities. */
  changes?: readonly LibraryChange[] | undefined
  occurredAt: number
  /**
   * Distinct writers behind this summary: `app` for application writes and
   * `extension:<id>` for writes an extension caused. An extension that pushes
   * data into the library skips summaries whose only writer is itself, which
   * removes the need for self-echo suppression state.
   */
  actors: readonly string[]
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
