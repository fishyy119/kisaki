/**
 * Library change contracts.
 *
 * Facet-level change descriptors computed by the main-process db change feed
 * and consumed by the `library.changed` / `library.entity-merged` hook points.
 */

import type {
  AnimeFormat,
  BloodType,
  ComicFormat,
  ComicReadingDirection,
  CupSize,
  Gender,
  MediaStatus,
  NovelFormat
} from './db/contracts/enums'
import type { DynamicCollectionConfig, PartialDate, ExternalSite } from './db/contracts/json'
import type { MediaRelationType } from './db/contracts/media-relations'
import type { ExternalId } from './identity'
import type { AllEntityType, MediaType } from './common'

/**
 * Entity types the change feed reports on.
 *
 * Composed from the entity union rather than restated, so a new media type
 * reaches the feed by widening `MediaType` alone.
 */
export type LibraryEntityTopic = AllEntityType

export type LibraryChangeKind = 'created' | 'updated' | 'deleted'

export interface LibraryGameCoreSnapshot {
  name?: string
  originalName?: string | null
  aliases?: string[]
  description?: string | null
  releaseDate?: PartialDate | null
}

export interface LibraryAnimeCoreSnapshot {
  name?: string
  originalName?: string | null
  aliases?: string[]
  description?: string | null
  releaseDate?: PartialDate | null
  format?: AnimeFormat
  totalEpisodes?: number | null
}

export interface LibraryComicCoreSnapshot {
  name?: string
  originalName?: string | null
  aliases?: string[]
  description?: string | null
  releaseDate?: PartialDate | null
  format?: ComicFormat
  readingDirection?: ComicReadingDirection | null
  totalVolumes?: number | null
  totalChapters?: number | null
}

export interface LibraryNovelCoreSnapshot {
  name?: string
  originalName?: string | null
  aliases?: string[]
  description?: string | null
  releaseDate?: PartialDate | null
  format?: NovelFormat
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
export interface LibraryMediaLinkSnapshot {
  personLinkIds: string[]
  companyLinkIds: string[]
  characterLinkIds: string[]
}

/**
 * Link snapshot of a media type that credits voice actors.
 *
 * Print media has no audio track, so comics and novels never carry cast rows
 * and their snapshot omits the field rather than reporting a constant empty
 * set. See {@link CastMediaType}.
 */
export interface LibraryCastMediaLinkSnapshot extends LibraryMediaLinkSnapshot {
  castLinkIds: string[]
}

/** One outgoing entry-to-entry edge as seen from the changed entity. */
export interface LibraryMediaRelationEdge {
  toType: MediaType
  toId: string
  type: MediaRelationType
}

export interface LibraryMediaRelationsSnapshot {
  relations: LibraryMediaRelationEdge[]
}

export type LibraryStatusChange = {
  facet: 'status'
  before: { status: MediaStatus }
  after: { status: MediaStatus }
  fields?: ['status']
}

export type LibraryActivityChange = {
  facet: 'activity'
  before: LibraryMediaActivitySnapshot
  after: LibraryMediaActivitySnapshot
  fields?: string[]
}

export type LibraryCollectionsChange = {
  facet: 'collections'
  before: { collectionIds: string[] }
  after: { collectionIds: string[] }
  fields?: string[]
}

/**
 * Watch-state transitions of an entry's episodes.
 *
 * Only the watched set is carried: resume positions and play counts churn
 * during playback and would turn the feed into a progress stream.
 */
export type LibraryEpisodesChange = {
  facet: 'episodes'
  before: { watchedEpisodeIds: string[] }
  after: { watchedEpisodeIds: string[] }
  fields?: ['watchedEpisodeIds']
}

/**
 * Read-state transitions of an entry's readable units (comic chapters, novel
 * volumes). Mirrors `LibraryEpisodesChange`: only the read set travels, resume
 * positions churn during reading and stay out of the feed.
 */
export type LibraryUnitsChange = {
  facet: 'units'
  before: { readUnitIds: string[] }
  after: { readUnitIds: string[] }
  fields?: ['readUnitIds']
}

export interface LibraryPersonCoreSnapshot {
  name?: string
  originalName?: string | null
  sortName?: string | null
  aliases?: string[]
  description?: string | null
  isFavorite?: boolean
  isNsfw?: boolean
  birthDate?: PartialDate | null
  deathDate?: PartialDate | null
  gender?: Gender | null
  externalSites?: ExternalSite[]
}

export interface LibraryCompanyCoreSnapshot {
  name?: string
  originalName?: string | null
  sortName?: string | null
  description?: string | null
  isFavorite?: boolean
  isNsfw?: boolean
  foundedDate?: PartialDate | null
  externalSites?: ExternalSite[]
}

export interface LibraryCharacterCoreSnapshot {
  name?: string
  originalName?: string | null
  sortName?: string | null
  aliases?: string[]
  description?: string | null
  isFavorite?: boolean
  isNsfw?: boolean
  birthDate?: PartialDate | null
  gender?: Gender | null
  bloodType?: BloodType | null
  height?: number | null
  weight?: number | null
  bust?: number | null
  waist?: number | null
  hips?: number | null
  cup?: CupSize | null
  age?: number | null
  externalSites?: ExternalSite[]
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
  gameIds?: string[]
  animeIds?: string[]
  comicIds?: string[]
  novelIds?: string[]
  personIds?: string[]
  companyIds?: string[]
  characterIds?: string[]
}

export type LibraryCoreChange<TSnapshot extends object> = {
  facet: 'core'
  before: Partial<TSnapshot>
  after: Partial<TSnapshot>
  fields?: string[]
}

export type LibraryScoreChange = {
  facet: 'score'
  before: { score: number | null }
  after: { score: number | null }
  fields?: ['score']
}

export type LibraryIdentityChange = {
  facet: 'identity'
  before: { externalIds: ExternalId[] }
  after: { externalIds: ExternalId[] }
  fields?: string[]
}

export type LibraryTagsChange = {
  facet: 'tags'
  before: { tagIds: string[] }
  after: { tagIds: string[] }
  fields?: string[]
}

export type LibraryAssetChange<TSnapshot extends object> = {
  facet: 'assets'
  before: Partial<TSnapshot>
  after: Partial<TSnapshot>
  fields?: string[]
}

export type LibraryLinksChange<TSnapshot extends object> = {
  facet: 'links'
  before: TSnapshot
  after: TSnapshot
  fields?: string[]
}

export type LibraryRelationsChange<TSnapshot extends object> = {
  facet: 'relations'
  before: TSnapshot
  after: TSnapshot
  fields?: string[]
}

export type LibraryMembershipChange<TSnapshot extends object> = {
  facet: 'membership'
  before: TSnapshot
  after: TSnapshot
  fields?: string[]
}

export type LibraryDynamicConfigChange = {
  facet: 'dynamicConfig'
  before: Partial<LibraryCollectionDynamicConfigSnapshot>
  after: Partial<LibraryCollectionDynamicConfigSnapshot>
  fields?: string[]
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

export type LibraryEntityChange =
  | LibraryPersonChange
  | LibraryCompanyChange
  | LibraryCharacterChange
  | LibraryCollectionChange
  | LibraryTagChange

export type LibraryChange =
  | LibraryGameChange
  | LibraryAnimeChange
  | LibraryComicChange
  | LibraryNovelChange
  | LibraryEntityChange

/** One debounced, entity-grouped change carried by the `library.changed` hook. */
export interface LibraryEntityChangeSummary {
  entity: LibraryEntityTopic
  id: string
  kind: LibraryChangeKind
  /** Present for created entities when a name is known. */
  name?: string
  /** Facet-level changes; present for updated entities. */
  changes?: LibraryChange[]
  occurredAt: number
  /**
   * Distinct writers behind this summary: `app` for application writes and
   * `extension:<id>` for writes an extension caused. A consumer that pushes
   * data into the library skips summaries whose only writer is itself.
   */
  actors: readonly string[]
}

export interface LibraryChangedPayload {
  changes: LibraryEntityChangeSummary[]
}

export interface LibraryEntityMergedEvent {
  entityType: AllEntityType
  targetId: string
  sourceId: string
  occurredAt: number
}
