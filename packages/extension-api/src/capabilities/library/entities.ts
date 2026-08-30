import type { ExternalId, PartialDate, ExternalSite, JsonObject } from '../../shared'
import type {
  LibraryAnimeEpisodeType,
  LibraryAnimeFormat,
  LibraryBloodType,
  LibraryComicFormat,
  LibraryCupSize,
  LibraryGender,
  LibraryNovelFormat
} from '../../shared/library'

/** Page progression / layout of a comic entry. */
export const LIBRARY_COMIC_READING_DIRECTIONS = ['rtl', 'ltr', 'vertical'] as const

export type LibraryComicReadingDirection = (typeof LIBRARY_COMIC_READING_DIRECTIONS)[number]

export interface SaveBackup {
  backupAt: number
  note: string
  locked: boolean
  saveFile: string
  sizeBytes?: number | undefined
}

export interface LibraryGameSession {
  id: string
  gameId: string
  startedAt: number
  endedAt: number
  createdAt: number
  updatedAt: number
}

export interface LibraryGameSessionCreateInput {
  startedAt: number
  endedAt: number
}

export interface LibraryGameNote {
  id: string
  gameId: string
  name: string
  content?: string | undefined
  coverFile?: string | undefined
  orderInGame: number
  createdAt: number
  updatedAt: number
}

export interface LibraryGameNoteCreateInput {
  name: string
  content?: string | undefined
  coverPath?: string | undefined
  createdAt?: number | undefined
  updatedAt?: number | undefined
  order?: number | undefined
}

export type SortDirection = 'asc' | 'desc'

export interface DynamicEntityConfig {
  enabled: boolean
  filter: JsonObject
  sortField: string
  sortDirection: SortDirection
}

export const DYNAMIC_COLLECTION_ENTITY_TYPES = [
  'game',
  'anime',
  'comic',
  'novel',
  'character',
  'person',
  'company'
] as const

export type DynamicCollectionConfig = Record<
  (typeof DYNAMIC_COLLECTION_ENTITY_TYPES)[number],
  DynamicEntityConfig
>

export const LIBRARY_ENTITY_TYPES = [
  'game',
  'anime',
  'comic',
  'novel',
  'character',
  'person',
  'company',
  'collection',
  'tag'
] as const

export type LibraryEntityType = (typeof LIBRARY_ENTITY_TYPES)[number]

export const LIBRARY_CONTENT_ENTITY_TYPES = [
  'game',
  'anime',
  'comic',
  'novel',
  'character',
  'person',
  'company'
] as const

export type LibraryContentEntityType = (typeof LIBRARY_CONTENT_ENTITY_TYPES)[number]

export const LIBRARY_ORGANIZER_ENTITY_TYPES = ['collection', 'tag'] as const

export type LibraryOrganizerEntityType = (typeof LIBRARY_ORGANIZER_ENTITY_TYPES)[number]

/**
 * Consumption status shared by every media type; mirrors the
 * wish/doing/done/on-hold/dropped collection vocabulary. Media-specific verbs
 * (playing, watching, reading) are display concerns, never separate enums.
 */
export const LIBRARY_MEDIA_STATUSES = [
  'planned',
  'active',
  'completed',
  'onHold',
  'dropped'
] as const

export type LibraryMediaStatus = (typeof LIBRARY_MEDIA_STATUSES)[number]

export const LIBRARY_GAME_LAUNCHER_MODES = ['file', 'url', 'exec'] as const

export type LibraryGameLauncherMode = (typeof LIBRARY_GAME_LAUNCHER_MODES)[number]

export const LIBRARY_GAME_MONITOR_MODES = ['file', 'folder', 'process'] as const

export type LibraryGameMonitorMode = (typeof LIBRARY_GAME_MONITOR_MODES)[number]

export interface LibraryEntityReference<TEntityType extends LibraryEntityType = LibraryEntityType> {
  entityType: TEntityType
  id: string
}

export interface LibraryListQuery {
  ids?: readonly string[] | undefined
  search?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
  sort?: {
    field: string
    direction?: SortDirection | undefined
  }
}

export interface LibraryEntityBase {
  id: string
  createdAt: number
  updatedAt: number
  name: string
  description?: string | undefined
}

export interface LibraryNamedEntityBase extends LibraryEntityBase {
  originalName?: string | undefined
  sortName?: string | undefined
}

export interface LibraryRankedEntityBase extends LibraryNamedEntityBase {
  score?: number | null | undefined
  isFavorite: boolean
  isNsfw: boolean
  externalSites?: readonly ExternalSite[] | undefined
}

export interface LibraryGame extends LibraryRankedEntityBase {
  coverFile?: string | undefined
  backdropFile?: string | undefined
  logoFile?: string | undefined
  iconFile?: string | undefined
  /** Other titles this entry is known by, such as localized names and abbreviations. */
  aliases?: readonly string[] | undefined
  releaseDate?: PartialDate | undefined
  status: LibraryMediaStatus
  lastActiveAt?: number | null | undefined
  totalDuration: number
  savePath?: string | undefined
  saveBackups?: readonly SaveBackup[] | undefined
  maxSaveBackups: number
  launcherMode: LibraryGameLauncherMode
  launcherPath?: string | undefined
  monitorMode: LibraryGameMonitorMode
  monitorPath?: string | undefined
  gameDirPath?: string | undefined
  descriptionInlineFiles?: readonly string[] | undefined
  externalIds: readonly ExternalId[]
}

export interface LibraryAnime extends LibraryRankedEntityBase {
  coverFile?: string | undefined
  backdropFile?: string | undefined
  logoFile?: string | undefined
  /** Other titles this entry is known by, such as localized names and abbreviations. */
  aliases?: readonly string[] | undefined
  releaseDate?: PartialDate | undefined
  status: LibraryMediaStatus
  format: LibraryAnimeFormat
  totalEpisodes?: number | null | undefined
  lastActiveAt?: number | null | undefined
  totalDuration: number
  animeDirPath?: string | undefined
  descriptionInlineFiles?: readonly string[] | undefined
  externalIds: readonly ExternalId[]
}

/**
 * One episode of an anime entry.
 *
 * Episodes are a sub-resource of their anime, not a library entity type:
 * they are addressed through the anime namespace and never appear in
 * `LibraryEntityType`.
 */
export interface LibraryAnimeEpisode {
  id: string
  animeId: string
  type: LibraryAnimeEpisodeType
  episodeNumber?: number | null | undefined
  name?: string | undefined
  originalName?: string | undefined
  airDate?: PartialDate | undefined
  description?: string | undefined
  stillFile?: string | undefined
  durationMs?: number | null | undefined
  watched: boolean
  /** Completion time of the last full playback; absent on episodes only marked. */
  watchedAt?: number | null | undefined
  playCount: number
  resumePositionMs?: number | null | undefined
  orderInAnime: number
  externalIds: readonly ExternalId[]
  createdAt: number
  updatedAt: number
}

export interface LibraryAnimeEpisodeCreateInput {
  type?: LibraryAnimeEpisodeType | undefined
  episodeNumber?: number | null | undefined
  name?: string | undefined
  originalName?: string | undefined
  airDate?: PartialDate | undefined
  description?: string | undefined
  durationMs?: number | null | undefined
  order?: number | undefined
  externalIds?: readonly ExternalId[] | undefined
}

/**
 * Watch-state patch for one episode; every field is optional.
 *
 * `watched` is the state, `watchedAt` the playback evidence: importers that
 * only know an episode was watched patch `watched` alone and leave the time
 * unset rather than inventing one. Clearing `watched` also clears the recorded
 * time; combining a cleared state with a time is rejected.
 */
export interface LibraryAnimeEpisodeWatchStatePatch {
  watched?: boolean | undefined
  watchedAt?: number | null | undefined
  playCount?: number | undefined
  resumePositionMs?: number | null | undefined
}

export interface LibraryAnimeEpisodeQuery {
  animeId: string
  types?: readonly LibraryAnimeEpisodeType[] | undefined
  watchedOnly?: boolean | undefined
  unwatchedOnly?: boolean | undefined
}

export interface LibraryComic extends LibraryRankedEntityBase {
  coverFile?: string | undefined
  backdropFile?: string | undefined
  logoFile?: string | undefined
  /** Other titles this entry is known by, such as localized names and abbreviations. */
  aliases?: readonly string[] | undefined
  releaseDate?: PartialDate | undefined
  status: LibraryMediaStatus
  format: LibraryComicFormat
  /** Per-entry layout override; absent follows the format default. */
  readingDirection?: LibraryComicReadingDirection | undefined
  totalVolumes?: number | null | undefined
  totalChapters?: number | null | undefined
  lastActiveAt?: number | null | undefined
  totalDuration: number
  comicDirPath?: string | undefined
  descriptionInlineFiles?: readonly string[] | undefined
  externalIds: readonly ExternalId[]
}

/**
 * One readable unit of a comic entry, at either grain: a collected volume
 * carries `volumeNumber`, a serialized chapter carries `chapterNumber`.
 *
 * Units are a sub-resource of their comic, not a library entity type: they
 * are addressed through the comic namespace and never appear in
 * `LibraryEntityType`.
 */
export interface LibraryComicChapter {
  id: string
  comicId: string
  volumeNumber?: number | null | undefined
  chapterNumber?: number | null | undefined
  name?: string | undefined
  originalName?: string | undefined
  releaseDate?: PartialDate | undefined
  description?: string | undefined
  coverFile?: string | undefined
  read: boolean
  /** Completion time of the last full read; absent on units only marked. */
  readAt?: number | null | undefined
  readCount: number
  resumePage?: number | null | undefined
  orderInComic: number
  externalIds: readonly ExternalId[]
  createdAt: number
  updatedAt: number
}

export interface LibraryComicChapterCreateInput {
  volumeNumber?: number | null | undefined
  chapterNumber?: number | null | undefined
  name?: string | undefined
  originalName?: string | undefined
  releaseDate?: PartialDate | undefined
  description?: string | undefined
  order?: number | undefined
  externalIds?: readonly ExternalId[] | undefined
}

/**
 * Read-state patch for one comic unit; every field is optional.
 *
 * `read` is the state, `readAt` the reading evidence: importers that only
 * know a unit was read patch `read` alone and leave the time unset rather
 * than inventing one. Clearing `read` also clears the recorded time;
 * combining a cleared state with a time is rejected.
 */
export interface LibraryComicChapterReadStatePatch {
  read?: boolean | undefined
  readAt?: number | null | undefined
  readCount?: number | undefined
  /** Zero-based page index to resume at; null once the unit is read. */
  resumePage?: number | null | undefined
}

export interface LibraryComicChapterQuery {
  comicId: string
  /** Keeps only units already read; `unreadOnly` is its complement. */
  finishedOnly?: boolean | undefined
  unreadOnly?: boolean | undefined
}

export interface LibraryNovel extends LibraryRankedEntityBase {
  coverFile?: string | undefined
  backdropFile?: string | undefined
  logoFile?: string | undefined
  /** Other titles this entry is known by, such as localized names and abbreviations. */
  aliases?: readonly string[] | undefined
  releaseDate?: PartialDate | undefined
  status: LibraryMediaStatus
  format: LibraryNovelFormat
  totalVolumes?: number | null | undefined
  lastActiveAt?: number | null | undefined
  totalDuration: number
  novelDirPath?: string | undefined
  descriptionInlineFiles?: readonly string[] | undefined
  externalIds: readonly ExternalId[]
}

/**
 * One volume of a novel entry.
 *
 * Volumes are a sub-resource of their novel, not a library entity type: they
 * are addressed through the novel namespace and never appear in
 * `LibraryEntityType`.
 */
export interface LibraryNovelVolume {
  id: string
  novelId: string
  volumeNumber?: number | null | undefined
  name?: string | undefined
  originalName?: string | undefined
  releaseDate?: PartialDate | undefined
  description?: string | undefined
  coverFile?: string | undefined
  read: boolean
  /** Completion time of the last full read; absent on volumes only marked. */
  readAt?: number | null | undefined
  readCount: number
  /** Engine-scoped resume locator; opaque to callers. */
  resumeLocator?: string | null | undefined
  /** Read fraction in [0, 1] for display; the locator stays authoritative. */
  resumeProgress?: number | null | undefined
  orderInNovel: number
  externalIds: readonly ExternalId[]
  createdAt: number
  updatedAt: number
}

export interface LibraryNovelVolumeCreateInput {
  volumeNumber?: number | null | undefined
  name?: string | undefined
  originalName?: string | undefined
  releaseDate?: PartialDate | undefined
  description?: string | undefined
  order?: number | undefined
  externalIds?: readonly ExternalId[] | undefined
}

/**
 * Read-state patch for one novel volume; see
 * {@link LibraryComicChapterReadStatePatch}, including the cleared-state rule.
 */
export interface LibraryNovelVolumeReadStatePatch {
  read?: boolean | undefined
  readAt?: number | null | undefined
  readCount?: number | undefined
  resumeLocator?: string | null | undefined
  /** Read fraction in [0, 1]; values outside the range are rejected. */
  resumeProgress?: number | null | undefined
}

export interface LibraryNovelVolumeQuery {
  novelId: string
  /** Keeps only volumes already read; `unreadOnly` is its complement. */
  finishedOnly?: boolean | undefined
  unreadOnly?: boolean | undefined
}

export interface LibraryPerson extends LibraryRankedEntityBase {
  photoFile?: string | undefined
  /** Other names this person is credited under, such as pen names. */
  aliases?: readonly string[] | undefined
  birthDate?: PartialDate | undefined
  deathDate?: PartialDate | undefined
  gender?: LibraryGender | undefined
  externalIds: readonly ExternalId[]
}

export interface LibraryCompany extends LibraryRankedEntityBase {
  foundedDate?: PartialDate | undefined
  logoFile?: string | undefined
  externalIds: readonly ExternalId[]
}

export interface LibraryCharacter extends LibraryRankedEntityBase {
  photoFile?: string | undefined
  /** Nicknames and romanizations this character is also known by. */
  aliases?: readonly string[] | undefined
  birthDate?: PartialDate | undefined
  gender?: LibraryGender | undefined
  bloodType?: LibraryBloodType | undefined
  height?: number | undefined
  weight?: number | undefined
  bust?: number | undefined
  waist?: number | undefined
  hips?: number | undefined
  cup?: LibraryCupSize | undefined
  age?: number | undefined
  externalIds: readonly ExternalId[]
}

export interface LibraryCollection extends LibraryEntityBase {
  coverFile?: string | undefined
  isNsfw: boolean
  order: number
  isDynamic: boolean
  dynamicConfig?: DynamicCollectionConfig | undefined
}

export interface LibraryTag extends LibraryEntityBase {
  isNsfw: boolean
}

export interface LibraryEntityInputBase {
  name: string
  description?: string | undefined
}

export interface LibraryNamedEntityInputBase extends LibraryEntityInputBase {
  originalName?: string | undefined
  sortName?: string | undefined
}

export interface LibraryRankedEntityInputBase extends LibraryNamedEntityInputBase {
  score?: number | null | undefined
  isFavorite?: boolean | undefined
  isNsfw?: boolean | undefined
  externalSites?: readonly ExternalSite[] | undefined
}

export interface LibraryGameCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number | undefined
  updatedAt?: number | undefined
  coverFile?: string | undefined
  backdropFile?: string | undefined
  logoFile?: string | undefined
  iconFile?: string | undefined
  aliases?: readonly string[] | undefined
  releaseDate?: PartialDate | undefined
  status?: LibraryMediaStatus | undefined
  lastActiveAt?: number | null | undefined
  totalDuration?: number | undefined
  savePath?: string | undefined
  saveBackups?: readonly SaveBackup[] | undefined
  maxSaveBackups?: number | undefined
  launcherMode?: LibraryGameLauncherMode | undefined
  launcherPath?: string | undefined
  monitorMode?: LibraryGameMonitorMode | undefined
  monitorPath?: string | undefined
  gameDirPath?: string | undefined
  descriptionInlineFiles?: readonly string[] | undefined
  externalIds?: readonly ExternalId[] | undefined
}

export type LibraryGamePatch = Partial<Omit<LibraryGameCreateInput, 'createdAt' | 'updatedAt'>> & {
  lastActiveAt?: number | null | undefined
  totalDuration?: number | undefined
}

export interface LibraryAnimeCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number | undefined
  updatedAt?: number | undefined
  coverFile?: string | undefined
  backdropFile?: string | undefined
  logoFile?: string | undefined
  aliases?: readonly string[] | undefined
  releaseDate?: PartialDate | undefined
  status?: LibraryMediaStatus | undefined
  format?: LibraryAnimeFormat | undefined
  totalEpisodes?: number | null | undefined
  lastActiveAt?: number | null | undefined
  totalDuration?: number | undefined
  animeDirPath?: string | undefined
  descriptionInlineFiles?: readonly string[] | undefined
  externalIds?: readonly ExternalId[] | undefined
}

export type LibraryAnimePatch = Partial<
  Omit<LibraryAnimeCreateInput, 'createdAt' | 'updatedAt'>
> & {
  lastActiveAt?: number | null | undefined
  totalDuration?: number | undefined
}

export interface LibraryComicCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number | undefined
  updatedAt?: number | undefined
  coverFile?: string | undefined
  backdropFile?: string | undefined
  logoFile?: string | undefined
  aliases?: readonly string[] | undefined
  releaseDate?: PartialDate | undefined
  status?: LibraryMediaStatus | undefined
  format?: LibraryComicFormat | undefined
  readingDirection?: LibraryComicReadingDirection | null | undefined
  totalVolumes?: number | null | undefined
  totalChapters?: number | null | undefined
  lastActiveAt?: number | null | undefined
  totalDuration?: number | undefined
  comicDirPath?: string | undefined
  descriptionInlineFiles?: readonly string[] | undefined
  externalIds?: readonly ExternalId[] | undefined
}

export type LibraryComicPatch = Partial<
  Omit<LibraryComicCreateInput, 'createdAt' | 'updatedAt'>
> & {
  lastActiveAt?: number | null | undefined
  totalDuration?: number | undefined
}

export interface LibraryNovelCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number | undefined
  updatedAt?: number | undefined
  coverFile?: string | undefined
  backdropFile?: string | undefined
  logoFile?: string | undefined
  aliases?: readonly string[] | undefined
  releaseDate?: PartialDate | undefined
  status?: LibraryMediaStatus | undefined
  format?: LibraryNovelFormat | undefined
  totalVolumes?: number | null | undefined
  lastActiveAt?: number | null | undefined
  totalDuration?: number | undefined
  novelDirPath?: string | undefined
  descriptionInlineFiles?: readonly string[] | undefined
  externalIds?: readonly ExternalId[] | undefined
}

export type LibraryNovelPatch = Partial<
  Omit<LibraryNovelCreateInput, 'createdAt' | 'updatedAt'>
> & {
  lastActiveAt?: number | null | undefined
  totalDuration?: number | undefined
}

export interface LibraryPersonCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number | undefined
  updatedAt?: number | undefined
  photoFile?: string | undefined
  aliases?: readonly string[] | undefined
  birthDate?: PartialDate | undefined
  deathDate?: PartialDate | undefined
  gender?: LibraryGender | undefined
  externalIds?: readonly ExternalId[] | undefined
}

export type LibraryPersonPatch = Partial<Omit<LibraryPersonCreateInput, 'createdAt' | 'updatedAt'>>

export interface LibraryCompanyCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number | undefined
  updatedAt?: number | undefined
  foundedDate?: PartialDate | undefined
  logoFile?: string | undefined
  externalIds?: readonly ExternalId[] | undefined
}

export type LibraryCompanyPatch = Partial<
  Omit<LibraryCompanyCreateInput, 'createdAt' | 'updatedAt'>
>

export interface LibraryCharacterCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number | undefined
  updatedAt?: number | undefined
  photoFile?: string | undefined
  aliases?: readonly string[] | undefined
  birthDate?: PartialDate | undefined
  gender?: LibraryGender | undefined
  bloodType?: LibraryBloodType | undefined
  height?: number | undefined
  weight?: number | undefined
  bust?: number | undefined
  waist?: number | undefined
  hips?: number | undefined
  cup?: LibraryCupSize | undefined
  age?: number | undefined
  externalIds?: readonly ExternalId[] | undefined
}

export type LibraryCharacterPatch = Partial<
  Omit<LibraryCharacterCreateInput, 'createdAt' | 'updatedAt'>
>

export interface LibraryCollectionCreateInput extends LibraryEntityInputBase {
  createdAt?: number | undefined
  updatedAt?: number | undefined
  coverFile?: string | undefined
  isNsfw?: boolean | undefined
  order?: number | undefined
  isDynamic?: boolean | undefined
  dynamicConfig?: DynamicCollectionConfig | undefined
}

export type LibraryCollectionPatch = Partial<
  Omit<LibraryCollectionCreateInput, 'createdAt' | 'updatedAt'>
>

export interface LibraryTagCreateInput extends LibraryEntityInputBase {
  createdAt?: number | undefined
  updatedAt?: number | undefined
  isNsfw?: boolean | undefined
}

export type LibraryTagPatch = Partial<Omit<LibraryTagCreateInput, 'createdAt' | 'updatedAt'>>

export interface LibraryGameQuery extends LibraryListQuery {
  statuses?: readonly LibraryMediaStatus[] | undefined
  favoritesOnly?: boolean | undefined
  includeNsfw?: boolean | undefined
  collectionIds?: readonly string[] | undefined
  tagIds?: readonly string[] | undefined
}

export interface LibraryAnimeQuery extends LibraryListQuery {
  statuses?: readonly LibraryMediaStatus[] | undefined
  formats?: readonly LibraryAnimeFormat[] | undefined
  favoritesOnly?: boolean | undefined
  includeNsfw?: boolean | undefined
  collectionIds?: readonly string[] | undefined
  tagIds?: readonly string[] | undefined
}

export interface LibraryComicQuery extends LibraryListQuery {
  statuses?: readonly LibraryMediaStatus[] | undefined
  formats?: readonly LibraryComicFormat[] | undefined
  favoritesOnly?: boolean | undefined
  includeNsfw?: boolean | undefined
  collectionIds?: readonly string[] | undefined
  tagIds?: readonly string[] | undefined
}

export interface LibraryNovelQuery extends LibraryListQuery {
  statuses?: readonly LibraryMediaStatus[] | undefined
  formats?: readonly LibraryNovelFormat[] | undefined
  favoritesOnly?: boolean | undefined
  includeNsfw?: boolean | undefined
  collectionIds?: readonly string[] | undefined
  tagIds?: readonly string[] | undefined
}

export interface LibraryPersonQuery extends LibraryListQuery {
  favoritesOnly?: boolean | undefined
  includeNsfw?: boolean | undefined
  genders?: readonly LibraryGender[] | undefined
  tagIds?: readonly string[] | undefined
}

export interface LibraryCompanyQuery extends LibraryListQuery {
  favoritesOnly?: boolean | undefined
  includeNsfw?: boolean | undefined
  tagIds?: readonly string[] | undefined
}

export interface LibraryCharacterQuery extends LibraryListQuery {
  favoritesOnly?: boolean | undefined
  includeNsfw?: boolean | undefined
  genders?: readonly LibraryGender[] | undefined
  tagIds?: readonly string[] | undefined
}

export interface LibraryCollectionQuery extends LibraryListQuery {
  includeDynamic?: boolean | undefined
  includeStatic?: boolean | undefined
}

export interface LibraryTagQuery extends LibraryListQuery {
  includeNsfw?: boolean | undefined
}
