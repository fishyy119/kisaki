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
  sizeBytes?: number
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
  content?: string
  coverFile?: string
  orderInGame: number
  createdAt: number
  updatedAt: number
}

export interface LibraryGameNoteCreateInput {
  name: string
  content?: string
  coverPath?: string
  createdAt?: number
  updatedAt?: number
  order?: number
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

/** Game completion status. */
export const LIBRARY_GAME_STATUSES = [
  'notStarted',
  'inProgress',
  'partial',
  'completed',
  'multiple',
  'shelved'
] as const

export type LibraryGameStatus = (typeof LIBRARY_GAME_STATUSES)[number]

/** Anime watch status; mirrors the wish/doing/done/on-hold/dropped collection vocabulary. */
export const LIBRARY_ANIME_STATUSES = [
  'planned',
  'watching',
  'completed',
  'onHold',
  'dropped'
] as const

export type LibraryAnimeStatus = (typeof LIBRARY_ANIME_STATUSES)[number]

/** Comic reading status; mirrors the wish/doing/done/on-hold/dropped collection vocabulary. */
export const LIBRARY_COMIC_STATUSES = [
  'planned',
  'reading',
  'completed',
  'onHold',
  'dropped'
] as const

export type LibraryComicStatus = (typeof LIBRARY_COMIC_STATUSES)[number]

/** Novel reading status; mirrors the wish/doing/done/on-hold/dropped collection vocabulary. */
export const LIBRARY_NOVEL_STATUSES = [
  'planned',
  'reading',
  'completed',
  'onHold',
  'dropped'
] as const

export type LibraryNovelStatus = (typeof LIBRARY_NOVEL_STATUSES)[number]

export const LIBRARY_GAME_LAUNCHER_MODES = ['file', 'url', 'exec'] as const

export type LibraryGameLauncherMode = (typeof LIBRARY_GAME_LAUNCHER_MODES)[number]

export const LIBRARY_GAME_MONITOR_MODES = ['file', 'folder', 'process'] as const

export type LibraryGameMonitorMode = (typeof LIBRARY_GAME_MONITOR_MODES)[number]

export interface LibraryEntityReference<TEntityType extends LibraryEntityType = LibraryEntityType> {
  entityType: TEntityType
  id: string
}

export interface LibraryListQuery {
  ids?: readonly string[]
  search?: string
  limit?: number
  offset?: number
  sort?: {
    field: string
    direction?: SortDirection
  }
}

export interface LibraryEntityBase {
  id: string
  createdAt: number
  updatedAt: number
  name: string
  description?: string
}

export interface LibraryNamedEntityBase extends LibraryEntityBase {
  originalName?: string
  sortName?: string
}

export interface LibraryRankedEntityBase extends LibraryNamedEntityBase {
  score?: number | null
  isFavorite: boolean
  isNsfw: boolean
  externalSites?: readonly ExternalSite[]
}

export interface LibraryGame extends LibraryRankedEntityBase {
  coverFile?: string
  backdropFile?: string
  logoFile?: string
  iconFile?: string
  /** Other titles this entry is known by, such as localized names and abbreviations. */
  aliases?: readonly string[]
  releaseDate?: PartialDate
  status: LibraryGameStatus
  lastActiveAt?: number | null
  totalDuration: number
  savePath?: string
  saveBackups?: readonly SaveBackup[]
  maxSaveBackups: number
  launcherMode: LibraryGameLauncherMode
  launcherPath?: string
  monitorMode: LibraryGameMonitorMode
  monitorPath?: string
  gameDirPath?: string
  descriptionInlineFiles?: readonly string[]
  externalIds: readonly ExternalId[]
}

export interface LibraryAnime extends LibraryRankedEntityBase {
  coverFile?: string
  backdropFile?: string
  logoFile?: string
  /** Other titles this entry is known by, such as localized names and abbreviations. */
  aliases?: readonly string[]
  releaseDate?: PartialDate
  status: LibraryAnimeStatus
  format: LibraryAnimeFormat
  totalEpisodes?: number | null
  lastActiveAt?: number | null
  totalDuration: number
  animeDirPath?: string
  descriptionInlineFiles?: readonly string[]
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
  episodeNumber?: number | null
  name?: string
  originalName?: string
  airDate?: PartialDate
  description?: string
  stillFile?: string
  durationMs?: number | null
  watched: boolean
  /** Completion time of the last full playback; absent on episodes only marked. */
  watchedAt?: number | null
  playCount: number
  resumePositionMs?: number | null
  orderInAnime: number
  externalIds: readonly ExternalId[]
  createdAt: number
  updatedAt: number
}

export interface LibraryAnimeEpisodeCreateInput {
  type?: LibraryAnimeEpisodeType
  episodeNumber?: number | null
  name?: string
  originalName?: string
  airDate?: PartialDate
  description?: string
  durationMs?: number | null
  order?: number
  externalIds?: readonly ExternalId[]
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
  watched?: boolean
  watchedAt?: number | null
  playCount?: number
  resumePositionMs?: number | null
}

export interface LibraryAnimeEpisodeQuery {
  animeId: string
  types?: readonly LibraryAnimeEpisodeType[]
  watchedOnly?: boolean
  unwatchedOnly?: boolean
}

export interface LibraryComic extends LibraryRankedEntityBase {
  coverFile?: string
  backdropFile?: string
  logoFile?: string
  /** Other titles this entry is known by, such as localized names and abbreviations. */
  aliases?: readonly string[]
  releaseDate?: PartialDate
  status: LibraryComicStatus
  format: LibraryComicFormat
  /** Per-entry layout override; absent follows the format default. */
  readingDirection?: LibraryComicReadingDirection
  totalVolumes?: number | null
  totalChapters?: number | null
  lastActiveAt?: number | null
  totalDuration: number
  comicDirPath?: string
  descriptionInlineFiles?: readonly string[]
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
  volumeNumber?: number | null
  chapterNumber?: number | null
  name?: string
  originalName?: string
  releaseDate?: PartialDate
  description?: string
  coverFile?: string
  read: boolean
  /** Completion time of the last full read; absent on units only marked. */
  readAt?: number | null
  readCount: number
  resumePage?: number | null
  orderInComic: number
  externalIds: readonly ExternalId[]
  createdAt: number
  updatedAt: number
}

export interface LibraryComicChapterCreateInput {
  volumeNumber?: number | null
  chapterNumber?: number | null
  name?: string
  originalName?: string
  releaseDate?: PartialDate
  description?: string
  order?: number
  externalIds?: readonly ExternalId[]
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
  read?: boolean
  readAt?: number | null
  readCount?: number
  /** Zero-based page index to resume at; null once the unit is read. */
  resumePage?: number | null
}

export interface LibraryComicChapterQuery {
  comicId: string
  /** Keeps only units already read; `unreadOnly` is its complement. */
  finishedOnly?: boolean
  unreadOnly?: boolean
}

export interface LibraryNovel extends LibraryRankedEntityBase {
  coverFile?: string
  backdropFile?: string
  logoFile?: string
  /** Other titles this entry is known by, such as localized names and abbreviations. */
  aliases?: readonly string[]
  releaseDate?: PartialDate
  status: LibraryNovelStatus
  format: LibraryNovelFormat
  totalVolumes?: number | null
  lastActiveAt?: number | null
  totalDuration: number
  novelDirPath?: string
  descriptionInlineFiles?: readonly string[]
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
  volumeNumber?: number | null
  name?: string
  originalName?: string
  releaseDate?: PartialDate
  description?: string
  coverFile?: string
  read: boolean
  /** Completion time of the last full read; absent on volumes only marked. */
  readAt?: number | null
  readCount: number
  /** Engine-scoped resume locator; opaque to callers. */
  resumeLocator?: string | null
  /** Read fraction in [0, 1] for display; the locator stays authoritative. */
  resumeProgress?: number | null
  orderInNovel: number
  externalIds: readonly ExternalId[]
  createdAt: number
  updatedAt: number
}

export interface LibraryNovelVolumeCreateInput {
  volumeNumber?: number | null
  name?: string
  originalName?: string
  releaseDate?: PartialDate
  description?: string
  order?: number
  externalIds?: readonly ExternalId[]
}

/**
 * Read-state patch for one novel volume; see
 * {@link LibraryComicChapterReadStatePatch}, including the cleared-state rule.
 */
export interface LibraryNovelVolumeReadStatePatch {
  read?: boolean
  readAt?: number | null
  readCount?: number
  resumeLocator?: string | null
  /** Read fraction in [0, 1]; values outside the range are rejected. */
  resumeProgress?: number | null
}

export interface LibraryNovelVolumeQuery {
  novelId: string
  /** Keeps only volumes already read; `unreadOnly` is its complement. */
  finishedOnly?: boolean
  unreadOnly?: boolean
}

export interface LibraryPerson extends LibraryRankedEntityBase {
  photoFile?: string
  /** Other names this person is credited under, such as pen names. */
  aliases?: readonly string[]
  birthDate?: PartialDate
  deathDate?: PartialDate
  gender?: LibraryGender
  externalIds: readonly ExternalId[]
}

export interface LibraryCompany extends LibraryRankedEntityBase {
  foundedDate?: PartialDate
  logoFile?: string
  externalIds: readonly ExternalId[]
}

export interface LibraryCharacter extends LibraryRankedEntityBase {
  photoFile?: string
  /** Nicknames and romanizations this character is also known by. */
  aliases?: readonly string[]
  birthDate?: PartialDate
  gender?: LibraryGender
  bloodType?: LibraryBloodType
  height?: number
  weight?: number
  bust?: number
  waist?: number
  hips?: number
  cup?: LibraryCupSize
  age?: number
  externalIds: readonly ExternalId[]
}

export interface LibraryCollection extends LibraryEntityBase {
  coverFile?: string
  isNsfw: boolean
  order: number
  isDynamic: boolean
  dynamicConfig?: DynamicCollectionConfig
}

export interface LibraryTag extends LibraryEntityBase {
  isNsfw: boolean
}

export interface LibraryEntityInputBase {
  name: string
  description?: string
}

export interface LibraryNamedEntityInputBase extends LibraryEntityInputBase {
  originalName?: string
  sortName?: string
}

export interface LibraryRankedEntityInputBase extends LibraryNamedEntityInputBase {
  score?: number | null
  isFavorite?: boolean
  isNsfw?: boolean
  externalSites?: readonly ExternalSite[]
}

export interface LibraryGameCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number
  updatedAt?: number
  coverFile?: string
  backdropFile?: string
  logoFile?: string
  iconFile?: string
  aliases?: readonly string[]
  releaseDate?: PartialDate
  status?: LibraryGameStatus
  lastActiveAt?: number | null
  totalDuration?: number
  savePath?: string
  saveBackups?: readonly SaveBackup[]
  maxSaveBackups?: number
  launcherMode?: LibraryGameLauncherMode
  launcherPath?: string
  monitorMode?: LibraryGameMonitorMode
  monitorPath?: string
  gameDirPath?: string
  descriptionInlineFiles?: readonly string[]
  externalIds?: readonly ExternalId[]
}

export type LibraryGamePatch = Partial<Omit<LibraryGameCreateInput, 'createdAt' | 'updatedAt'>> & {
  lastActiveAt?: number | null
  totalDuration?: number
}

export interface LibraryAnimeCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number
  updatedAt?: number
  coverFile?: string
  backdropFile?: string
  logoFile?: string
  aliases?: readonly string[]
  releaseDate?: PartialDate
  status?: LibraryAnimeStatus
  format?: LibraryAnimeFormat
  totalEpisodes?: number | null
  lastActiveAt?: number | null
  totalDuration?: number
  animeDirPath?: string
  descriptionInlineFiles?: readonly string[]
  externalIds?: readonly ExternalId[]
}

export type LibraryAnimePatch = Partial<
  Omit<LibraryAnimeCreateInput, 'createdAt' | 'updatedAt'>
> & {
  lastActiveAt?: number | null
  totalDuration?: number
}

export interface LibraryComicCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number
  updatedAt?: number
  coverFile?: string
  backdropFile?: string
  logoFile?: string
  aliases?: readonly string[]
  releaseDate?: PartialDate
  status?: LibraryComicStatus
  format?: LibraryComicFormat
  readingDirection?: LibraryComicReadingDirection | null
  totalVolumes?: number | null
  totalChapters?: number | null
  lastActiveAt?: number | null
  totalDuration?: number
  comicDirPath?: string
  descriptionInlineFiles?: readonly string[]
  externalIds?: readonly ExternalId[]
}

export type LibraryComicPatch = Partial<
  Omit<LibraryComicCreateInput, 'createdAt' | 'updatedAt'>
> & {
  lastActiveAt?: number | null
  totalDuration?: number
}

export interface LibraryNovelCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number
  updatedAt?: number
  coverFile?: string
  backdropFile?: string
  logoFile?: string
  aliases?: readonly string[]
  releaseDate?: PartialDate
  status?: LibraryNovelStatus
  format?: LibraryNovelFormat
  totalVolumes?: number | null
  lastActiveAt?: number | null
  totalDuration?: number
  novelDirPath?: string
  descriptionInlineFiles?: readonly string[]
  externalIds?: readonly ExternalId[]
}

export type LibraryNovelPatch = Partial<
  Omit<LibraryNovelCreateInput, 'createdAt' | 'updatedAt'>
> & {
  lastActiveAt?: number | null
  totalDuration?: number
}

export interface LibraryPersonCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number
  updatedAt?: number
  photoFile?: string
  aliases?: readonly string[]
  birthDate?: PartialDate
  deathDate?: PartialDate
  gender?: LibraryGender
  externalIds?: readonly ExternalId[]
}

export type LibraryPersonPatch = Partial<Omit<LibraryPersonCreateInput, 'createdAt' | 'updatedAt'>>

export interface LibraryCompanyCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number
  updatedAt?: number
  foundedDate?: PartialDate
  logoFile?: string
  externalIds?: readonly ExternalId[]
}

export type LibraryCompanyPatch = Partial<
  Omit<LibraryCompanyCreateInput, 'createdAt' | 'updatedAt'>
>

export interface LibraryCharacterCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number
  updatedAt?: number
  photoFile?: string
  aliases?: readonly string[]
  birthDate?: PartialDate
  gender?: LibraryGender
  bloodType?: LibraryBloodType
  height?: number
  weight?: number
  bust?: number
  waist?: number
  hips?: number
  cup?: LibraryCupSize
  age?: number
  externalIds?: readonly ExternalId[]
}

export type LibraryCharacterPatch = Partial<
  Omit<LibraryCharacterCreateInput, 'createdAt' | 'updatedAt'>
>

export interface LibraryCollectionCreateInput extends LibraryEntityInputBase {
  createdAt?: number
  updatedAt?: number
  coverFile?: string
  isNsfw?: boolean
  order?: number
  isDynamic?: boolean
  dynamicConfig?: DynamicCollectionConfig
}

export type LibraryCollectionPatch = Partial<
  Omit<LibraryCollectionCreateInput, 'createdAt' | 'updatedAt'>
>

export interface LibraryTagCreateInput extends LibraryEntityInputBase {
  createdAt?: number
  updatedAt?: number
  isNsfw?: boolean
}

export type LibraryTagPatch = Partial<Omit<LibraryTagCreateInput, 'createdAt' | 'updatedAt'>>

export interface LibraryGameQuery extends LibraryListQuery {
  statuses?: readonly LibraryGameStatus[]
  favoritesOnly?: boolean
  includeNsfw?: boolean
  collectionIds?: readonly string[]
  tagIds?: readonly string[]
}

export interface LibraryAnimeQuery extends LibraryListQuery {
  statuses?: readonly LibraryAnimeStatus[]
  formats?: readonly LibraryAnimeFormat[]
  favoritesOnly?: boolean
  includeNsfw?: boolean
  collectionIds?: readonly string[]
  tagIds?: readonly string[]
}

export interface LibraryComicQuery extends LibraryListQuery {
  statuses?: readonly LibraryComicStatus[]
  formats?: readonly LibraryComicFormat[]
  favoritesOnly?: boolean
  includeNsfw?: boolean
  collectionIds?: readonly string[]
  tagIds?: readonly string[]
}

export interface LibraryNovelQuery extends LibraryListQuery {
  statuses?: readonly LibraryNovelStatus[]
  formats?: readonly LibraryNovelFormat[]
  favoritesOnly?: boolean
  includeNsfw?: boolean
  collectionIds?: readonly string[]
  tagIds?: readonly string[]
}

export interface LibraryPersonQuery extends LibraryListQuery {
  favoritesOnly?: boolean
  includeNsfw?: boolean
  genders?: readonly LibraryGender[]
  tagIds?: readonly string[]
}

export interface LibraryCompanyQuery extends LibraryListQuery {
  favoritesOnly?: boolean
  includeNsfw?: boolean
  tagIds?: readonly string[]
}

export interface LibraryCharacterQuery extends LibraryListQuery {
  favoritesOnly?: boolean
  includeNsfw?: boolean
  genders?: readonly LibraryGender[]
  tagIds?: readonly string[]
}

export interface LibraryCollectionQuery extends LibraryListQuery {
  includeDynamic?: boolean
  includeStatic?: boolean
}

export interface LibraryTagQuery extends LibraryListQuery {
  includeNsfw?: boolean
}
