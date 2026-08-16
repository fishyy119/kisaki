import type { ExternalId, PartialDate, ExternalSite, JsonObject } from '../../shared'
import type {
  LibraryAnimeEpisodeType,
  LibraryAnimeFormat,
  LibraryBloodType,
  LibraryCupSize,
  LibraryGender,
  LibraryMovieFormat,
  LibraryTvFormat
} from '../../shared/library'

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
  'tv',
  'movie',
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
  'tv',
  'movie',
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
  'tv',
  'movie',
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

/** TV watch status; a show tracks the same states an anime entry does. */
export const LIBRARY_TV_STATUSES = [
  'planned',
  'watching',
  'completed',
  'onHold',
  'dropped'
] as const

export type LibraryTvStatus = (typeof LIBRARY_TV_STATUSES)[number]

/** Movie watch status; a film is one unit, so the same states still apply. */
export const LIBRARY_MOVIE_STATUSES = [
  'planned',
  'watching',
  'completed',
  'onHold',
  'dropped'
] as const

export type LibraryMovieStatus = (typeof LIBRARY_MOVIE_STATUSES)[number]

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

export interface LibraryTv extends LibraryRankedEntityBase {
  coverFile?: string
  backdropFile?: string
  logoFile?: string
  /** First air date of the show; season air dates live on the season rows. */
  releaseDate?: PartialDate
  /** Last air date; absent while the show is still running. */
  endDate?: PartialDate
  status: LibraryTvStatus
  format: LibraryTvFormat
  totalSeasons?: number | null
  totalEpisodes?: number | null
  lastActiveAt?: number | null
  totalDuration: number
  tvDirPath?: string
  descriptionInlineFiles?: readonly string[]
  externalIds: readonly ExternalId[]
}

/**
 * One season of a show.
 *
 * Seasons are weak child rows of their show, not a library entity type: they
 * carry per-season metadata but never tracking state, and are addressed
 * through the tv namespace.
 */
export interface LibraryTvSeason {
  id: string
  tvId: string
  /** Season 0 holds specials; regular seasons start at 1. */
  seasonNumber: number
  name?: string
  originalName?: string
  airDate?: PartialDate
  description?: string
  posterFile?: string
  totalEpisodes?: number | null
  orderInTv: number
  createdAt: number
  updatedAt: number
}

/**
 * One episode of a show.
 *
 * Episodes are a sub-resource of their show and carry its watch grain;
 * specials are the episodes of season 0 rather than a separate type.
 */
export interface LibraryTvEpisode {
  id: string
  tvId: string
  seasonId: string
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
  orderInSeason: number
  orderInTv: number
  externalIds: readonly ExternalId[]
  createdAt: number
  updatedAt: number
}

export interface LibraryTvSeasonCreateInput {
  seasonNumber: number
  name?: string
  originalName?: string
  airDate?: PartialDate
  description?: string
  totalEpisodes?: number | null
  order?: number
}

export interface LibraryTvEpisodeCreateInput {
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
export interface LibraryTvEpisodeWatchStatePatch {
  watched?: boolean
  watchedAt?: number | null
  playCount?: number
  resumePositionMs?: number | null
}

export interface LibraryTvSeasonQuery {
  tvId: string
  /** Season 0 is the specials season; excluded when this is false. */
  includeSpecials?: boolean
}

export interface LibraryTvEpisodeQuery {
  tvId: string
  /** Restricts the result to one season of the show. */
  seasonNumbers?: readonly number[]
  watchedOnly?: boolean
  unwatchedOnly?: boolean
}

export interface LibraryMovie extends LibraryRankedEntityBase {
  coverFile?: string
  backdropFile?: string
  logoFile?: string
  releaseDate?: PartialDate
  status: LibraryMovieStatus
  format: LibraryMovieFormat
  /** Runtime declared by metadata; probed file durations stay authoritative. */
  runtimeMs?: number | null
  watched: boolean
  /** Completion time of the last full playback; absent on films only marked. */
  watchedAt?: number | null
  playCount: number
  resumePositionMs?: number | null
  lastActiveAt?: number | null
  totalDuration: number
  movieDirPath?: string
  descriptionInlineFiles?: readonly string[]
  externalIds: readonly ExternalId[]
}

export interface LibraryPerson extends LibraryRankedEntityBase {
  photoFile?: string
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

export interface LibraryTvCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number
  updatedAt?: number
  coverFile?: string
  backdropFile?: string
  logoFile?: string
  releaseDate?: PartialDate
  endDate?: PartialDate
  status?: LibraryTvStatus
  format?: LibraryTvFormat
  totalSeasons?: number | null
  totalEpisodes?: number | null
  lastActiveAt?: number | null
  totalDuration?: number
  tvDirPath?: string
  descriptionInlineFiles?: readonly string[]
  externalIds?: readonly ExternalId[]
}

export type LibraryTvPatch = Partial<Omit<LibraryTvCreateInput, 'createdAt' | 'updatedAt'>> & {
  lastActiveAt?: number | null
  totalDuration?: number
}

export interface LibraryMovieCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number
  updatedAt?: number
  coverFile?: string
  backdropFile?: string
  logoFile?: string
  releaseDate?: PartialDate
  status?: LibraryMovieStatus
  format?: LibraryMovieFormat
  runtimeMs?: number | null
  watched?: boolean
  watchedAt?: number | null
  playCount?: number
  resumePositionMs?: number | null
  lastActiveAt?: number | null
  totalDuration?: number
  movieDirPath?: string
  descriptionInlineFiles?: readonly string[]
  externalIds?: readonly ExternalId[]
}

export type LibraryMoviePatch = Partial<
  Omit<LibraryMovieCreateInput, 'createdAt' | 'updatedAt'>
> & {
  lastActiveAt?: number | null
  totalDuration?: number
}

export interface LibraryPersonCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number
  updatedAt?: number
  photoFile?: string
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

export interface LibraryTvQuery extends LibraryListQuery {
  statuses?: readonly LibraryTvStatus[]
  formats?: readonly LibraryTvFormat[]
  favoritesOnly?: boolean
  includeNsfw?: boolean
  collectionIds?: readonly string[]
  tagIds?: readonly string[]
}

export interface LibraryMovieQuery extends LibraryListQuery {
  statuses?: readonly LibraryMovieStatus[]
  formats?: readonly LibraryMovieFormat[]
  favoritesOnly?: boolean
  watchedOnly?: boolean
  unwatchedOnly?: boolean
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
