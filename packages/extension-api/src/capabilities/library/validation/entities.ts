import type {
  LibraryAnimeCreateInput,
  LibraryAnimeEpisodeCreateInput,
  LibraryAnimeEpisodeQuery,
  LibraryAnimeEpisodeWatchStatePatch,
  LibraryAnimePatch,
  LibraryAnimeQuery,
  LibraryCharacterCreateInput,
  LibraryCharacterPatch,
  LibraryCharacterQuery,
  LibraryCollectionCreateInput,
  LibraryCollectionPatch,
  LibraryCollectionQuery,
  LibraryCompanyCreateInput,
  LibraryCompanyPatch,
  LibraryCompanyQuery,
  LibraryGameCreateInput,
  LibraryGamePatch,
  LibraryGameQuery,
  LibraryMovieCreateInput,
  LibraryMoviePatch,
  LibraryMovieQuery,
  LibraryPersonCreateInput,
  LibraryPersonPatch,
  LibraryPersonQuery,
  LibraryTagCreateInput,
  LibraryTagPatch,
  LibraryTagQuery,
  LibraryTvCreateInput,
  LibraryTvEpisodeCreateInput,
  LibraryTvEpisodeQuery,
  LibraryTvEpisodeWatchStatePatch,
  LibraryTvPatch,
  LibraryTvQuery,
  LibraryTvSeasonCreateInput,
  LibraryTvSeasonQuery,
  SortDirection
} from '../entities'
import {
  LIBRARY_ANIME_STATUSES,
  LIBRARY_GAME_LAUNCHER_MODES,
  LIBRARY_GAME_MONITOR_MODES,
  LIBRARY_GAME_STATUSES,
  LIBRARY_MOVIE_STATUSES,
  LIBRARY_TV_STATUSES
} from '../entities'
import {
  LIBRARY_ANIME_EPISODE_TYPES,
  LIBRARY_ANIME_FORMATS,
  LIBRARY_BLOOD_TYPES,
  LIBRARY_CUP_SIZES,
  LIBRARY_GENDERS,
  LIBRARY_MOVIE_FORMATS,
  LIBRARY_TV_FORMATS
} from '../../../shared/library'
import type { ValidationIssue } from '../../../shared/validation'
import {
  validateOptionalBoolean,
  validateOptionalEnumString,
  validateOptionalFiniteNumber,
  validateOptionalString,
  validateRequiredEnumString,
  validateRequiredString,
  validateUnknownKeys
} from '../../../shared/validation'
import {
  ENTITY_BASE_CREATE_KEYS,
  RANKED_ENTITY_KEYS,
  isRecord,
  requireWriteObject,
  throwIfValidationIssues,
  validateEntityBaseFields,
  validateOptionalDynamicCollectionConfig,
  validateOptionalExternalIds,
  validateOptionalInteger,
  validateOptionalNonEmptyString,
  validateOptionalNonNegativeFiniteNumber,
  validateOptionalNonNegativeInteger,
  validateOptionalNullableFiniteNumber,
  validateOptionalPartialDate,
  validateOptionalSaveBackups,
  validateOptionalStringArray,
  validateRankedEntityFields
} from './common'

const CREATE_TIMESTAMP_KEYS = ['createdAt', 'updatedAt'] as const
const GAME_CREATE_KEYS = new Set<string>([
  ...RANKED_ENTITY_KEYS,
  ...CREATE_TIMESTAMP_KEYS,
  'coverFile',
  'backdropFile',
  'logoFile',
  'iconFile',
  'releaseDate',
  'status',
  'lastActiveAt',
  'totalDuration',
  'savePath',
  'saveBackups',
  'maxSaveBackups',
  'launcherMode',
  'launcherPath',
  'monitorMode',
  'monitorPath',
  'gameDirPath',
  'descriptionInlineFiles',
  'externalIds'
])
const GAME_PATCH_KEYS = new Set<string>([
  ...RANKED_ENTITY_KEYS,
  'coverFile',
  'backdropFile',
  'logoFile',
  'iconFile',
  'releaseDate',
  'status',
  'savePath',
  'saveBackups',
  'maxSaveBackups',
  'launcherMode',
  'launcherPath',
  'monitorMode',
  'monitorPath',
  'gameDirPath',
  'descriptionInlineFiles',
  'externalIds',
  'lastActiveAt',
  'totalDuration'
])
const ANIME_CREATE_KEYS = new Set<string>([
  ...RANKED_ENTITY_KEYS,
  ...CREATE_TIMESTAMP_KEYS,
  'coverFile',
  'backdropFile',
  'logoFile',
  'releaseDate',
  'status',
  'format',
  'totalEpisodes',
  'lastActiveAt',
  'totalDuration',
  'animeDirPath',
  'descriptionInlineFiles',
  'externalIds'
])
const ANIME_PATCH_KEYS = new Set<string>([
  ...RANKED_ENTITY_KEYS,
  'coverFile',
  'backdropFile',
  'logoFile',
  'releaseDate',
  'status',
  'format',
  'totalEpisodes',
  'animeDirPath',
  'descriptionInlineFiles',
  'externalIds',
  'lastActiveAt',
  'totalDuration'
])
const ANIME_EPISODE_CREATE_KEYS = new Set<string>([
  'type',
  'episodeNumber',
  'name',
  'originalName',
  'airDate',
  'description',
  'durationMs',
  'order',
  'externalIds'
])
const ANIME_EPISODE_WATCH_STATE_KEYS = new Set<string>([
  'watched',
  'watchedAt',
  'playCount',
  'resumePositionMs'
])
const ANIME_EPISODE_QUERY_KEYS = new Set<string>([
  'animeId',
  'types',
  'watchedOnly',
  'unwatchedOnly'
])
const TV_CREATE_KEYS = new Set<string>([
  ...RANKED_ENTITY_KEYS,
  ...CREATE_TIMESTAMP_KEYS,
  'coverFile',
  'backdropFile',
  'logoFile',
  'releaseDate',
  'endDate',
  'status',
  'format',
  'totalSeasons',
  'totalEpisodes',
  'lastActiveAt',
  'totalDuration',
  'tvDirPath',
  'descriptionInlineFiles',
  'externalIds'
])
const TV_PATCH_KEYS = new Set<string>([
  ...RANKED_ENTITY_KEYS,
  'coverFile',
  'backdropFile',
  'logoFile',
  'releaseDate',
  'endDate',
  'status',
  'format',
  'totalSeasons',
  'totalEpisodes',
  'tvDirPath',
  'descriptionInlineFiles',
  'externalIds',
  'lastActiveAt',
  'totalDuration'
])
const TV_SEASON_CREATE_KEYS = new Set<string>([
  'seasonNumber',
  'name',
  'originalName',
  'airDate',
  'description',
  'totalEpisodes',
  'order'
])
const TV_EPISODE_CREATE_KEYS = new Set<string>([
  'episodeNumber',
  'name',
  'originalName',
  'airDate',
  'description',
  'durationMs',
  'order',
  'externalIds'
])
const TV_EPISODE_WATCH_STATE_KEYS = new Set<string>([
  'watched',
  'watchedAt',
  'playCount',
  'resumePositionMs'
])
const TV_SEASON_QUERY_KEYS = new Set<string>(['tvId', 'includeSpecials'])
const TV_EPISODE_QUERY_KEYS = new Set<string>([
  'tvId',
  'seasonNumbers',
  'watchedOnly',
  'unwatchedOnly'
])
const MOVIE_CREATE_KEYS = new Set<string>([
  ...RANKED_ENTITY_KEYS,
  ...CREATE_TIMESTAMP_KEYS,
  'coverFile',
  'backdropFile',
  'logoFile',
  'releaseDate',
  'status',
  'format',
  'runtimeMs',
  'watched',
  'watchedAt',
  'playCount',
  'resumePositionMs',
  'lastActiveAt',
  'totalDuration',
  'movieDirPath',
  'descriptionInlineFiles',
  'externalIds'
])
const MOVIE_PATCH_KEYS = new Set<string>([
  ...RANKED_ENTITY_KEYS,
  'coverFile',
  'backdropFile',
  'logoFile',
  'releaseDate',
  'status',
  'format',
  'runtimeMs',
  'watched',
  'watchedAt',
  'playCount',
  'resumePositionMs',
  'movieDirPath',
  'descriptionInlineFiles',
  'externalIds',
  'lastActiveAt',
  'totalDuration'
])
const PERSON_CREATE_KEYS = new Set<string>([
  ...RANKED_ENTITY_KEYS,
  ...CREATE_TIMESTAMP_KEYS,
  'photoFile',
  'birthDate',
  'deathDate',
  'gender',
  'externalIds'
])
const PERSON_PATCH_KEYS = new Set<string>([
  ...RANKED_ENTITY_KEYS,
  'photoFile',
  'birthDate',
  'deathDate',
  'gender',
  'externalIds'
])
const COMPANY_CREATE_KEYS = new Set<string>([
  ...RANKED_ENTITY_KEYS,
  ...CREATE_TIMESTAMP_KEYS,
  'foundedDate',
  'logoFile',
  'externalIds'
])
const COMPANY_PATCH_KEYS = new Set<string>([
  ...RANKED_ENTITY_KEYS,
  'foundedDate',
  'logoFile',
  'externalIds'
])
const CHARACTER_CREATE_KEYS = new Set<string>([
  ...RANKED_ENTITY_KEYS,
  ...CREATE_TIMESTAMP_KEYS,
  'photoFile',
  'birthDate',
  'gender',
  'bloodType',
  'height',
  'weight',
  'bust',
  'waist',
  'hips',
  'cup',
  'age',
  'externalIds'
])
const CHARACTER_PATCH_KEYS = new Set<string>([
  ...RANKED_ENTITY_KEYS,
  'photoFile',
  'birthDate',
  'gender',
  'bloodType',
  'height',
  'weight',
  'bust',
  'waist',
  'hips',
  'cup',
  'age',
  'externalIds'
])
const COLLECTION_CREATE_KEYS = new Set<string>([
  ...ENTITY_BASE_CREATE_KEYS,
  ...CREATE_TIMESTAMP_KEYS,
  'coverFile',
  'isNsfw',
  'order',
  'isDynamic',
  'dynamicConfig'
])
const COLLECTION_PATCH_KEYS = new Set<string>([
  ...ENTITY_BASE_CREATE_KEYS,
  'coverFile',
  'isNsfw',
  'order',
  'isDynamic',
  'dynamicConfig'
])
const TAG_CREATE_KEYS = new Set<string>([
  ...ENTITY_BASE_CREATE_KEYS,
  ...CREATE_TIMESTAMP_KEYS,
  'isNsfw'
])
const TAG_PATCH_KEYS = new Set<string>([...ENTITY_BASE_CREATE_KEYS, 'isNsfw'])
const SORT_DIRECTIONS = ['asc', 'desc'] as const satisfies readonly SortDirection[]
const LIST_QUERY_BASE_KEYS = ['ids', 'search', 'limit', 'offset', 'sort'] as const
const SORT_QUERY_KEYS = new Set<string>(['field', 'direction'])
const ANIME_QUERY_KEYS = new Set<string>([
  ...LIST_QUERY_BASE_KEYS,
  'statuses',
  'formats',
  'favoritesOnly',
  'includeNsfw',
  'collectionIds',
  'tagIds'
])
const GAME_QUERY_KEYS = new Set<string>([
  ...LIST_QUERY_BASE_KEYS,
  'statuses',
  'favoritesOnly',
  'includeNsfw',
  'collectionIds',
  'tagIds'
])
const TV_QUERY_KEYS = new Set<string>([
  ...LIST_QUERY_BASE_KEYS,
  'statuses',
  'formats',
  'favoritesOnly',
  'includeNsfw',
  'collectionIds',
  'tagIds'
])
const MOVIE_QUERY_KEYS = new Set<string>([
  ...LIST_QUERY_BASE_KEYS,
  'statuses',
  'formats',
  'favoritesOnly',
  'watchedOnly',
  'unwatchedOnly',
  'includeNsfw',
  'collectionIds',
  'tagIds'
])
const PERSON_QUERY_KEYS = new Set<string>([
  ...LIST_QUERY_BASE_KEYS,
  'favoritesOnly',
  'includeNsfw',
  'genders',
  'tagIds'
])
const COMPANY_QUERY_KEYS = new Set<string>([
  ...LIST_QUERY_BASE_KEYS,
  'favoritesOnly',
  'includeNsfw',
  'tagIds'
])
const CHARACTER_QUERY_KEYS = PERSON_QUERY_KEYS
const COLLECTION_QUERY_KEYS = new Set<string>([
  ...LIST_QUERY_BASE_KEYS,
  'includeDynamic',
  'includeStatic'
])
const TAG_QUERY_KEYS = new Set<string>([...LIST_QUERY_BASE_KEYS, 'includeNsfw'])

export function validateLibraryGameCreateInput(value: unknown): ValidationIssue[] {
  return validateGameWriteInput(value, '$', true)
}

export function validateLibraryGamePatch(value: unknown): ValidationIssue[] {
  return validateGameWriteInput(value, '$', false)
}

export function validateLibraryAnimeCreateInput(value: unknown): ValidationIssue[] {
  return validateAnimeWriteInput(value, '$', true)
}

export function validateLibraryAnimePatch(value: unknown): ValidationIssue[] {
  return validateAnimeWriteInput(value, '$', false)
}

export function validateLibraryAnimeEpisodeCreateInput(value: unknown): ValidationIssue[] {
  return validateAnimeEpisodeCreateInput(value, '$')
}

export function validateLibraryAnimeEpisodeWatchStatePatch(value: unknown): ValidationIssue[] {
  const input = requireWriteObject(value, '$', 'Anime episode watch state patch')
  if (!input) {
    return [{ path: '$', message: 'Anime episode watch state patch must be an object.' }]
  }

  return [
    ...validateUnknownKeys(input, ANIME_EPISODE_WATCH_STATE_KEYS),
    ...validateOptionalBoolean(input.watched, '$.watched'),
    ...validateOptionalNullableFiniteNumber(input.watchedAt, '$.watchedAt'),
    ...validateOptionalNonNegativeInteger(input.playCount, '$.playCount'),
    ...validateOptionalNullableFiniteNumber(input.resumePositionMs, '$.resumePositionMs')
  ]
}

export function validateLibraryAnimeEpisodeQuery(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: '$', message: 'Anime episode query must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, ANIME_EPISODE_QUERY_KEYS),
    ...validateRequiredString(value.animeId, '$.animeId', {
      trim: true,
      valueMessage: 'animeId must be a non-empty string.'
    }),
    ...validateOptionalEnumArray(
      value.types,
      '$.types',
      LIBRARY_ANIME_EPISODE_TYPES,
      'types must be an array of supported anime episode types.'
    ),
    ...validateOptionalBoolean(value.watchedOnly, '$.watchedOnly'),
    ...validateOptionalBoolean(value.unwatchedOnly, '$.unwatchedOnly')
  ]
}

export function validateLibraryTvCreateInput(value: unknown): ValidationIssue[] {
  return validateTvWriteInput(value, '$', true)
}

export function validateLibraryTvPatch(value: unknown): ValidationIssue[] {
  return validateTvWriteInput(value, '$', false)
}

export function validateLibraryTvSeasonCreateInput(value: unknown): ValidationIssue[] {
  return validateTvSeasonCreateInput(value, '$')
}

export function validateLibraryTvEpisodeCreateInput(value: unknown): ValidationIssue[] {
  return validateTvEpisodeCreateInput(value, '$')
}

export function validateLibraryTvEpisodeWatchStatePatch(value: unknown): ValidationIssue[] {
  const input = requireWriteObject(value, '$', 'TV episode watch state patch')
  if (!input) {
    return [{ path: '$', message: 'TV episode watch state patch must be an object.' }]
  }

  return [
    ...validateUnknownKeys(input, TV_EPISODE_WATCH_STATE_KEYS),
    ...validateOptionalBoolean(input.watched, '$.watched'),
    ...validateOptionalNullableFiniteNumber(input.watchedAt, '$.watchedAt'),
    ...validateOptionalNonNegativeInteger(input.playCount, '$.playCount'),
    ...validateOptionalNullableFiniteNumber(input.resumePositionMs, '$.resumePositionMs')
  ]
}

export function validateLibraryTvSeasonQuery(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: '$', message: 'TV season query must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, TV_SEASON_QUERY_KEYS),
    ...validateRequiredString(value.tvId, '$.tvId', {
      trim: true,
      valueMessage: 'tvId must be a non-empty string.'
    }),
    ...validateOptionalBoolean(value.includeSpecials, '$.includeSpecials')
  ]
}

export function validateLibraryTvEpisodeQuery(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: '$', message: 'TV episode query must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, TV_EPISODE_QUERY_KEYS),
    ...validateRequiredString(value.tvId, '$.tvId', {
      trim: true,
      valueMessage: 'tvId must be a non-empty string.'
    }),
    ...validateOptionalIntegerArray(value.seasonNumbers, '$.seasonNumbers'),
    ...validateOptionalBoolean(value.watchedOnly, '$.watchedOnly'),
    ...validateOptionalBoolean(value.unwatchedOnly, '$.unwatchedOnly')
  ]
}

export function validateLibraryMovieCreateInput(value: unknown): ValidationIssue[] {
  return validateMovieWriteInput(value, '$', true)
}

export function validateLibraryMoviePatch(value: unknown): ValidationIssue[] {
  return validateMovieWriteInput(value, '$', false)
}

export function validateLibraryPersonCreateInput(value: unknown): ValidationIssue[] {
  return validatePersonWriteInput(value, '$', true)
}

export function validateLibraryPersonPatch(value: unknown): ValidationIssue[] {
  return validatePersonWriteInput(value, '$', false)
}

export function validateLibraryCompanyCreateInput(value: unknown): ValidationIssue[] {
  return validateCompanyWriteInput(value, '$', true)
}

export function validateLibraryCompanyPatch(value: unknown): ValidationIssue[] {
  return validateCompanyWriteInput(value, '$', false)
}

export function validateLibraryCharacterCreateInput(value: unknown): ValidationIssue[] {
  return validateCharacterWriteInput(value, '$', true)
}

export function validateLibraryCharacterPatch(value: unknown): ValidationIssue[] {
  return validateCharacterWriteInput(value, '$', false)
}

export function validateLibraryCollectionCreateInput(value: unknown): ValidationIssue[] {
  return validateCollectionWriteInput(value, '$', true)
}

export function validateLibraryCollectionPatch(value: unknown): ValidationIssue[] {
  return validateCollectionWriteInput(value, '$', false)
}

export function validateLibraryTagCreateInput(value: unknown): ValidationIssue[] {
  return validateTagWriteInput(value, '$', true)
}

export function validateLibraryTagPatch(value: unknown): ValidationIssue[] {
  return validateTagWriteInput(value, '$', false)
}

export function validateLibraryGameQuery(value: unknown): ValidationIssue[] {
  const query = requireQueryObject(value)
  if (!query) {
    return value === undefined ? [] : [{ path: '$', message: 'Game list query must be an object.' }]
  }

  return [
    ...validateBaseListQuery(query, GAME_QUERY_KEYS),
    ...validateOptionalEnumArray(
      query.statuses,
      '$.statuses',
      LIBRARY_GAME_STATUSES,
      'statuses must be an array of supported game statuses.'
    ),
    ...validateOptionalBoolean(query.favoritesOnly, '$.favoritesOnly'),
    ...validateOptionalBoolean(query.includeNsfw, '$.includeNsfw'),
    ...validateOptionalNonEmptyStringArray(query.collectionIds, '$.collectionIds'),
    ...validateOptionalNonEmptyStringArray(query.tagIds, '$.tagIds')
  ]
}

export function validateLibraryAnimeQuery(value: unknown): ValidationIssue[] {
  const query = requireQueryObject(value)
  if (!query) {
    return value === undefined
      ? []
      : [{ path: '$', message: 'Anime list query must be an object.' }]
  }

  return [
    ...validateBaseListQuery(query, ANIME_QUERY_KEYS),
    ...validateOptionalEnumArray(
      query.statuses,
      '$.statuses',
      LIBRARY_ANIME_STATUSES,
      'statuses must be an array of supported anime statuses.'
    ),
    ...validateOptionalEnumArray(
      query.formats,
      '$.formats',
      LIBRARY_ANIME_FORMATS,
      'formats must be an array of supported anime formats.'
    ),
    ...validateOptionalBoolean(query.favoritesOnly, '$.favoritesOnly'),
    ...validateOptionalBoolean(query.includeNsfw, '$.includeNsfw'),
    ...validateOptionalNonEmptyStringArray(query.collectionIds, '$.collectionIds'),
    ...validateOptionalNonEmptyStringArray(query.tagIds, '$.tagIds')
  ]
}

export function validateLibraryTvQuery(value: unknown): ValidationIssue[] {
  const query = requireQueryObject(value)
  if (!query) {
    return value === undefined ? [] : [{ path: '$', message: 'TV list query must be an object.' }]
  }

  return [
    ...validateBaseListQuery(query, TV_QUERY_KEYS),
    ...validateOptionalEnumArray(
      query.statuses,
      '$.statuses',
      LIBRARY_TV_STATUSES,
      'statuses must be an array of supported tv statuses.'
    ),
    ...validateOptionalEnumArray(
      query.formats,
      '$.formats',
      LIBRARY_TV_FORMATS,
      'formats must be an array of supported tv formats.'
    ),
    ...validateOptionalBoolean(query.favoritesOnly, '$.favoritesOnly'),
    ...validateOptionalBoolean(query.includeNsfw, '$.includeNsfw'),
    ...validateOptionalNonEmptyStringArray(query.collectionIds, '$.collectionIds'),
    ...validateOptionalNonEmptyStringArray(query.tagIds, '$.tagIds')
  ]
}

export function validateLibraryMovieQuery(value: unknown): ValidationIssue[] {
  const query = requireQueryObject(value)
  if (!query) {
    return value === undefined
      ? []
      : [{ path: '$', message: 'Movie list query must be an object.' }]
  }

  return [
    ...validateBaseListQuery(query, MOVIE_QUERY_KEYS),
    ...validateOptionalEnumArray(
      query.statuses,
      '$.statuses',
      LIBRARY_MOVIE_STATUSES,
      'statuses must be an array of supported movie statuses.'
    ),
    ...validateOptionalEnumArray(
      query.formats,
      '$.formats',
      LIBRARY_MOVIE_FORMATS,
      'formats must be an array of supported movie formats.'
    ),
    ...validateOptionalBoolean(query.favoritesOnly, '$.favoritesOnly'),
    ...validateOptionalBoolean(query.watchedOnly, '$.watchedOnly'),
    ...validateOptionalBoolean(query.unwatchedOnly, '$.unwatchedOnly'),
    ...validateOptionalBoolean(query.includeNsfw, '$.includeNsfw'),
    ...validateOptionalNonEmptyStringArray(query.collectionIds, '$.collectionIds'),
    ...validateOptionalNonEmptyStringArray(query.tagIds, '$.tagIds')
  ]
}

export function validateLibraryPersonQuery(value: unknown): ValidationIssue[] {
  const query = requireQueryObject(value)
  if (!query) {
    return value === undefined
      ? []
      : [{ path: '$', message: 'Person list query must be an object.' }]
  }

  return [
    ...validateBaseListQuery(query, PERSON_QUERY_KEYS),
    ...validateOptionalBoolean(query.favoritesOnly, '$.favoritesOnly'),
    ...validateOptionalBoolean(query.includeNsfw, '$.includeNsfw'),
    ...validateOptionalEnumArray(
      query.genders,
      '$.genders',
      LIBRARY_GENDERS,
      'genders must be an array of supported gender values.'
    ),
    ...validateOptionalNonEmptyStringArray(query.tagIds, '$.tagIds')
  ]
}

export function validateLibraryCompanyQuery(value: unknown): ValidationIssue[] {
  const query = requireQueryObject(value)
  if (!query) {
    return value === undefined
      ? []
      : [{ path: '$', message: 'Company list query must be an object.' }]
  }

  return [
    ...validateBaseListQuery(query, COMPANY_QUERY_KEYS),
    ...validateOptionalBoolean(query.favoritesOnly, '$.favoritesOnly'),
    ...validateOptionalBoolean(query.includeNsfw, '$.includeNsfw'),
    ...validateOptionalNonEmptyStringArray(query.tagIds, '$.tagIds')
  ]
}

export function validateLibraryCharacterQuery(value: unknown): ValidationIssue[] {
  const query = requireQueryObject(value)
  if (!query) {
    return value === undefined
      ? []
      : [{ path: '$', message: 'Character list query must be an object.' }]
  }

  return [
    ...validateBaseListQuery(query, CHARACTER_QUERY_KEYS),
    ...validateOptionalBoolean(query.favoritesOnly, '$.favoritesOnly'),
    ...validateOptionalBoolean(query.includeNsfw, '$.includeNsfw'),
    ...validateOptionalEnumArray(
      query.genders,
      '$.genders',
      LIBRARY_GENDERS,
      'genders must be an array of supported gender values.'
    ),
    ...validateOptionalNonEmptyStringArray(query.tagIds, '$.tagIds')
  ]
}

export function validateLibraryCollectionQuery(value: unknown): ValidationIssue[] {
  const query = requireQueryObject(value)
  if (!query) {
    return value === undefined
      ? []
      : [{ path: '$', message: 'Collection list query must be an object.' }]
  }

  return [
    ...validateBaseListQuery(query, COLLECTION_QUERY_KEYS),
    ...validateOptionalBoolean(query.includeDynamic, '$.includeDynamic'),
    ...validateOptionalBoolean(query.includeStatic, '$.includeStatic')
  ]
}

export function validateLibraryTagQuery(value: unknown): ValidationIssue[] {
  const query = requireQueryObject(value)
  if (!query) {
    return value === undefined ? [] : [{ path: '$', message: 'Tag list query must be an object.' }]
  }

  return [
    ...validateBaseListQuery(query, TAG_QUERY_KEYS),
    ...validateOptionalBoolean(query.includeNsfw, '$.includeNsfw')
  ]
}

export function assertValidLibraryGameCreateInput(
  value: unknown
): asserts value is LibraryGameCreateInput {
  throwIfValidationIssues('library.games.create input', validateLibraryGameCreateInput(value))
}

export function assertValidLibraryGamePatch(value: unknown): asserts value is LibraryGamePatch {
  throwIfValidationIssues('library.games.update patch', validateLibraryGamePatch(value))
}

export function assertValidLibraryAnimeCreateInput(
  value: unknown
): asserts value is LibraryAnimeCreateInput {
  throwIfValidationIssues('library.animes.create input', validateLibraryAnimeCreateInput(value))
}

export function assertValidLibraryAnimePatch(value: unknown): asserts value is LibraryAnimePatch {
  throwIfValidationIssues('library.animes.update patch', validateLibraryAnimePatch(value))
}

export function assertValidLibraryAnimeEpisodeCreateInput(
  value: unknown
): asserts value is LibraryAnimeEpisodeCreateInput {
  throwIfValidationIssues(
    'library.animes.episodes.create input',
    validateLibraryAnimeEpisodeCreateInput(value)
  )
}

export function assertValidLibraryAnimeEpisodeWatchStatePatch(
  value: unknown
): asserts value is LibraryAnimeEpisodeWatchStatePatch {
  throwIfValidationIssues(
    'library.animes.episodes.patchWatchState patch',
    validateLibraryAnimeEpisodeWatchStatePatch(value)
  )
}

export function assertValidLibraryAnimeEpisodeQuery(
  value: unknown
): asserts value is LibraryAnimeEpisodeQuery {
  throwIfValidationIssues(
    'library.animes.episodes.list query',
    validateLibraryAnimeEpisodeQuery(value)
  )
}

export function assertValidLibraryAnimeQuery(
  value: unknown
): asserts value is LibraryAnimeQuery | undefined {
  throwIfValidationIssues('library.animes.list query', validateLibraryAnimeQuery(value))
}

export function assertValidLibraryTvCreateInput(
  value: unknown
): asserts value is LibraryTvCreateInput {
  throwIfValidationIssues('library.tvs.create input', validateLibraryTvCreateInput(value))
}

export function assertValidLibraryTvPatch(value: unknown): asserts value is LibraryTvPatch {
  throwIfValidationIssues('library.tvs.update patch', validateLibraryTvPatch(value))
}

export function assertValidLibraryTvSeasonCreateInput(
  value: unknown
): asserts value is LibraryTvSeasonCreateInput {
  throwIfValidationIssues(
    'library.tvs.seasons.create input',
    validateLibraryTvSeasonCreateInput(value)
  )
}

export function assertValidLibraryTvEpisodeCreateInput(
  value: unknown
): asserts value is LibraryTvEpisodeCreateInput {
  throwIfValidationIssues(
    'library.tvs.episodes.create input',
    validateLibraryTvEpisodeCreateInput(value)
  )
}

export function assertValidLibraryTvEpisodeWatchStatePatch(
  value: unknown
): asserts value is LibraryTvEpisodeWatchStatePatch {
  throwIfValidationIssues(
    'library.tvs.episodes.patchWatchState patch',
    validateLibraryTvEpisodeWatchStatePatch(value)
  )
}

export function assertValidLibraryTvSeasonQuery(
  value: unknown
): asserts value is LibraryTvSeasonQuery {
  throwIfValidationIssues('library.tvs.seasons.list query', validateLibraryTvSeasonQuery(value))
}

export function assertValidLibraryTvEpisodeQuery(
  value: unknown
): asserts value is LibraryTvEpisodeQuery {
  throwIfValidationIssues('library.tvs.episodes.list query', validateLibraryTvEpisodeQuery(value))
}

export function assertValidLibraryTvQuery(
  value: unknown
): asserts value is LibraryTvQuery | undefined {
  throwIfValidationIssues('library.tvs.list query', validateLibraryTvQuery(value))
}

export function assertValidLibraryMovieCreateInput(
  value: unknown
): asserts value is LibraryMovieCreateInput {
  throwIfValidationIssues('library.movies.create input', validateLibraryMovieCreateInput(value))
}

export function assertValidLibraryMoviePatch(value: unknown): asserts value is LibraryMoviePatch {
  throwIfValidationIssues('library.movies.update patch', validateLibraryMoviePatch(value))
}

export function assertValidLibraryMovieQuery(
  value: unknown
): asserts value is LibraryMovieQuery | undefined {
  throwIfValidationIssues('library.movies.list query', validateLibraryMovieQuery(value))
}

export function assertValidLibraryPersonCreateInput(
  value: unknown
): asserts value is LibraryPersonCreateInput {
  throwIfValidationIssues('library.persons.create input', validateLibraryPersonCreateInput(value))
}

export function assertValidLibraryPersonPatch(value: unknown): asserts value is LibraryPersonPatch {
  throwIfValidationIssues('library.persons.update patch', validateLibraryPersonPatch(value))
}

export function assertValidLibraryCompanyCreateInput(
  value: unknown
): asserts value is LibraryCompanyCreateInput {
  throwIfValidationIssues(
    'library.companies.create input',
    validateLibraryCompanyCreateInput(value)
  )
}

export function assertValidLibraryCompanyPatch(
  value: unknown
): asserts value is LibraryCompanyPatch {
  throwIfValidationIssues('library.companies.update patch', validateLibraryCompanyPatch(value))
}

export function assertValidLibraryCharacterCreateInput(
  value: unknown
): asserts value is LibraryCharacterCreateInput {
  throwIfValidationIssues(
    'library.characters.create input',
    validateLibraryCharacterCreateInput(value)
  )
}

export function assertValidLibraryCharacterPatch(
  value: unknown
): asserts value is LibraryCharacterPatch {
  throwIfValidationIssues('library.characters.update patch', validateLibraryCharacterPatch(value))
}

export function assertValidLibraryCollectionCreateInput(
  value: unknown
): asserts value is LibraryCollectionCreateInput {
  throwIfValidationIssues(
    'library.collections.create input',
    validateLibraryCollectionCreateInput(value)
  )
}

export function assertValidLibraryCollectionPatch(
  value: unknown
): asserts value is LibraryCollectionPatch {
  throwIfValidationIssues('library.collections.update patch', validateLibraryCollectionPatch(value))
}

export function assertValidLibraryTagCreateInput(
  value: unknown
): asserts value is LibraryTagCreateInput {
  throwIfValidationIssues('library.tags.create input', validateLibraryTagCreateInput(value))
}

export function assertValidLibraryTagPatch(value: unknown): asserts value is LibraryTagPatch {
  throwIfValidationIssues('library.tags.update patch', validateLibraryTagPatch(value))
}

export function assertValidLibraryGameQuery(
  value: unknown
): asserts value is LibraryGameQuery | undefined {
  throwIfValidationIssues('library.games.list query', validateLibraryGameQuery(value))
}

export function assertValidLibraryPersonQuery(
  value: unknown
): asserts value is LibraryPersonQuery | undefined {
  throwIfValidationIssues('library.persons.list query', validateLibraryPersonQuery(value))
}

export function assertValidLibraryCompanyQuery(
  value: unknown
): asserts value is LibraryCompanyQuery | undefined {
  throwIfValidationIssues('library.companies.list query', validateLibraryCompanyQuery(value))
}

export function assertValidLibraryCharacterQuery(
  value: unknown
): asserts value is LibraryCharacterQuery | undefined {
  throwIfValidationIssues('library.characters.list query', validateLibraryCharacterQuery(value))
}

export function assertValidLibraryCollectionQuery(
  value: unknown
): asserts value is LibraryCollectionQuery | undefined {
  throwIfValidationIssues('library.collections.list query', validateLibraryCollectionQuery(value))
}

export function assertValidLibraryTagQuery(
  value: unknown
): asserts value is LibraryTagQuery | undefined {
  throwIfValidationIssues('library.tags.list query', validateLibraryTagQuery(value))
}

function validateGameWriteInput(value: unknown, path: string, create: boolean): ValidationIssue[] {
  const input = requireWriteObject(value, path, create ? 'Game create input' : 'Game patch')
  if (!input) {
    return [
      {
        path,
        message: create ? 'Game create input must be an object.' : 'Game patch must be an object.'
      }
    ]
  }

  return [
    ...validateUnknownKeys(input, create ? GAME_CREATE_KEYS : GAME_PATCH_KEYS, path),
    ...validateRankedEntityFields(input, path, create),
    ...validateCreateTimestamps(input, path, create),
    ...validateOptionalNonEmptyString(input.coverFile, `${path}.coverFile`),
    ...validateOptionalNonEmptyString(input.backdropFile, `${path}.backdropFile`),
    ...validateOptionalNonEmptyString(input.logoFile, `${path}.logoFile`),
    ...validateOptionalNonEmptyString(input.iconFile, `${path}.iconFile`),
    ...validateOptionalPartialDate(input.releaseDate, `${path}.releaseDate`),
    ...validateOptionalEnumString(
      input.status,
      `${path}.status`,
      LIBRARY_GAME_STATUSES,
      'status must be one of the supported game statuses.'
    ),
    ...validateOptionalString(input.savePath, `${path}.savePath`),
    ...validateOptionalSaveBackups(input.saveBackups, `${path}.saveBackups`),
    ...validateOptionalNonNegativeInteger(input.maxSaveBackups, `${path}.maxSaveBackups`),
    ...validateOptionalEnumString(
      input.launcherMode,
      `${path}.launcherMode`,
      LIBRARY_GAME_LAUNCHER_MODES,
      'launcherMode must be one of the supported launcher modes.'
    ),
    ...validateOptionalString(input.launcherPath, `${path}.launcherPath`),
    ...validateOptionalEnumString(
      input.monitorMode,
      `${path}.monitorMode`,
      LIBRARY_GAME_MONITOR_MODES,
      'monitorMode must be one of the supported monitor modes.'
    ),
    ...validateOptionalString(input.monitorPath, `${path}.monitorPath`),
    ...validateOptionalString(input.gameDirPath, `${path}.gameDirPath`),
    ...validateOptionalStringArray(input.descriptionInlineFiles, `${path}.descriptionInlineFiles`),
    ...validateOptionalExternalIds(input.externalIds, `${path}.externalIds`),
    ...validateOptionalNullableFiniteNumber(input.lastActiveAt, `${path}.lastActiveAt`),
    ...validateOptionalNonNegativeFiniteNumber(input.totalDuration, `${path}.totalDuration`)
  ]
}

function validateAnimeWriteInput(value: unknown, path: string, create: boolean): ValidationIssue[] {
  const input = requireWriteObject(value, path, create ? 'Anime create input' : 'Anime patch')
  if (!input) {
    return [
      {
        path,
        message: create ? 'Anime create input must be an object.' : 'Anime patch must be an object.'
      }
    ]
  }

  return [
    ...validateUnknownKeys(input, create ? ANIME_CREATE_KEYS : ANIME_PATCH_KEYS, path),
    ...validateRankedEntityFields(input, path, create),
    ...validateCreateTimestamps(input, path, create),
    ...validateOptionalNonEmptyString(input.coverFile, `${path}.coverFile`),
    ...validateOptionalNonEmptyString(input.backdropFile, `${path}.backdropFile`),
    ...validateOptionalNonEmptyString(input.logoFile, `${path}.logoFile`),
    ...validateOptionalPartialDate(input.releaseDate, `${path}.releaseDate`),
    ...validateOptionalEnumString(
      input.status,
      `${path}.status`,
      LIBRARY_ANIME_STATUSES,
      'status must be one of the supported anime statuses.'
    ),
    ...validateOptionalEnumString(
      input.format,
      `${path}.format`,
      LIBRARY_ANIME_FORMATS,
      'format must be one of the supported anime formats.'
    ),
    ...validateOptionalNullableFiniteNumber(input.totalEpisodes, `${path}.totalEpisodes`),
    ...validateOptionalString(input.animeDirPath, `${path}.animeDirPath`),
    ...validateOptionalStringArray(input.descriptionInlineFiles, `${path}.descriptionInlineFiles`),
    ...validateOptionalExternalIds(input.externalIds, `${path}.externalIds`),
    ...validateOptionalNullableFiniteNumber(input.lastActiveAt, `${path}.lastActiveAt`),
    ...validateOptionalNonNegativeFiniteNumber(input.totalDuration, `${path}.totalDuration`)
  ]
}

function validateAnimeEpisodeCreateInput(value: unknown, path: string): ValidationIssue[] {
  const input = requireWriteObject(value, path, 'Anime episode create input')
  if (!input) {
    return [{ path, message: 'Anime episode create input must be an object.' }]
  }

  return [
    ...validateUnknownKeys(input, ANIME_EPISODE_CREATE_KEYS, path),
    ...validateOptionalEnumString(
      input.type,
      `${path}.type`,
      LIBRARY_ANIME_EPISODE_TYPES,
      'type must be one of the supported anime episode types.'
    ),
    ...validateOptionalNullableFiniteNumber(input.episodeNumber, `${path}.episodeNumber`),
    ...validateOptionalString(input.name, `${path}.name`),
    ...validateOptionalString(input.originalName, `${path}.originalName`),
    ...validateOptionalPartialDate(input.airDate, `${path}.airDate`),
    ...validateOptionalString(input.description, `${path}.description`),
    ...validateOptionalNullableFiniteNumber(input.durationMs, `${path}.durationMs`),
    ...validateOptionalNonNegativeInteger(input.order, `${path}.order`),
    ...validateOptionalExternalIds(input.externalIds, `${path}.externalIds`)
  ]
}

function validateTvWriteInput(value: unknown, path: string, create: boolean): ValidationIssue[] {
  const input = requireWriteObject(value, path, create ? 'TV create input' : 'TV patch')
  if (!input) {
    return [
      {
        path,
        message: create ? 'TV create input must be an object.' : 'TV patch must be an object.'
      }
    ]
  }

  return [
    ...validateUnknownKeys(input, create ? TV_CREATE_KEYS : TV_PATCH_KEYS, path),
    ...validateRankedEntityFields(input, path, create),
    ...validateCreateTimestamps(input, path, create),
    ...validateOptionalNonEmptyString(input.coverFile, `${path}.coverFile`),
    ...validateOptionalNonEmptyString(input.backdropFile, `${path}.backdropFile`),
    ...validateOptionalNonEmptyString(input.logoFile, `${path}.logoFile`),
    ...validateOptionalPartialDate(input.releaseDate, `${path}.releaseDate`),
    ...validateOptionalPartialDate(input.endDate, `${path}.endDate`),
    ...validateOptionalEnumString(
      input.status,
      `${path}.status`,
      LIBRARY_TV_STATUSES,
      'status must be one of the supported tv statuses.'
    ),
    ...validateOptionalEnumString(
      input.format,
      `${path}.format`,
      LIBRARY_TV_FORMATS,
      'format must be one of the supported tv formats.'
    ),
    ...validateOptionalNullableFiniteNumber(input.totalSeasons, `${path}.totalSeasons`),
    ...validateOptionalNullableFiniteNumber(input.totalEpisodes, `${path}.totalEpisodes`),
    ...validateOptionalString(input.tvDirPath, `${path}.tvDirPath`),
    ...validateOptionalStringArray(input.descriptionInlineFiles, `${path}.descriptionInlineFiles`),
    ...validateOptionalExternalIds(input.externalIds, `${path}.externalIds`),
    ...validateOptionalNullableFiniteNumber(input.lastActiveAt, `${path}.lastActiveAt`),
    ...validateOptionalNonNegativeFiniteNumber(input.totalDuration, `${path}.totalDuration`)
  ]
}

function validateTvSeasonCreateInput(value: unknown, path: string): ValidationIssue[] {
  const input = requireWriteObject(value, path, 'TV season create input')
  if (!input) {
    return [{ path, message: 'TV season create input must be an object.' }]
  }

  return [
    ...validateUnknownKeys(input, TV_SEASON_CREATE_KEYS, path),
    ...validateRequiredSeasonNumber(input.seasonNumber, `${path}.seasonNumber`),
    ...validateOptionalString(input.name, `${path}.name`),
    ...validateOptionalString(input.originalName, `${path}.originalName`),
    ...validateOptionalPartialDate(input.airDate, `${path}.airDate`),
    ...validateOptionalString(input.description, `${path}.description`),
    ...validateOptionalNullableFiniteNumber(input.totalEpisodes, `${path}.totalEpisodes`),
    ...validateOptionalNonNegativeInteger(input.order, `${path}.order`)
  ]
}

function validateTvEpisodeCreateInput(value: unknown, path: string): ValidationIssue[] {
  const input = requireWriteObject(value, path, 'TV episode create input')
  if (!input) {
    return [{ path, message: 'TV episode create input must be an object.' }]
  }

  return [
    ...validateUnknownKeys(input, TV_EPISODE_CREATE_KEYS, path),
    ...validateOptionalNullableFiniteNumber(input.episodeNumber, `${path}.episodeNumber`),
    ...validateOptionalString(input.name, `${path}.name`),
    ...validateOptionalString(input.originalName, `${path}.originalName`),
    ...validateOptionalPartialDate(input.airDate, `${path}.airDate`),
    ...validateOptionalString(input.description, `${path}.description`),
    ...validateOptionalNullableFiniteNumber(input.durationMs, `${path}.durationMs`),
    ...validateOptionalNonNegativeInteger(input.order, `${path}.order`),
    ...validateOptionalExternalIds(input.externalIds, `${path}.externalIds`)
  ]
}

function validateMovieWriteInput(value: unknown, path: string, create: boolean): ValidationIssue[] {
  const input = requireWriteObject(value, path, create ? 'Movie create input' : 'Movie patch')
  if (!input) {
    return [
      {
        path,
        message: create ? 'Movie create input must be an object.' : 'Movie patch must be an object.'
      }
    ]
  }

  return [
    ...validateUnknownKeys(input, create ? MOVIE_CREATE_KEYS : MOVIE_PATCH_KEYS, path),
    ...validateRankedEntityFields(input, path, create),
    ...validateCreateTimestamps(input, path, create),
    ...validateOptionalNonEmptyString(input.coverFile, `${path}.coverFile`),
    ...validateOptionalNonEmptyString(input.backdropFile, `${path}.backdropFile`),
    ...validateOptionalNonEmptyString(input.logoFile, `${path}.logoFile`),
    ...validateOptionalPartialDate(input.releaseDate, `${path}.releaseDate`),
    ...validateOptionalEnumString(
      input.status,
      `${path}.status`,
      LIBRARY_MOVIE_STATUSES,
      'status must be one of the supported movie statuses.'
    ),
    ...validateOptionalEnumString(
      input.format,
      `${path}.format`,
      LIBRARY_MOVIE_FORMATS,
      'format must be one of the supported movie formats.'
    ),
    ...validateOptionalNullableFiniteNumber(input.runtimeMs, `${path}.runtimeMs`),
    ...validateOptionalBoolean(input.watched, `${path}.watched`),
    ...validateOptionalNullableFiniteNumber(input.watchedAt, `${path}.watchedAt`),
    ...validateOptionalNonNegativeInteger(input.playCount, `${path}.playCount`),
    ...validateOptionalNullableFiniteNumber(input.resumePositionMs, `${path}.resumePositionMs`),
    ...validateOptionalString(input.movieDirPath, `${path}.movieDirPath`),
    ...validateOptionalStringArray(input.descriptionInlineFiles, `${path}.descriptionInlineFiles`),
    ...validateOptionalExternalIds(input.externalIds, `${path}.externalIds`),
    ...validateOptionalNullableFiniteNumber(input.lastActiveAt, `${path}.lastActiveAt`),
    ...validateOptionalNonNegativeFiniteNumber(input.totalDuration, `${path}.totalDuration`)
  ]
}

function validatePersonWriteInput(
  value: unknown,
  path: string,
  create: boolean
): ValidationIssue[] {
  const input = requireWriteObject(value, path, create ? 'Person create input' : 'Person patch')
  if (!input) {
    return [
      {
        path,
        message: create
          ? 'Person create input must be an object.'
          : 'Person patch must be an object.'
      }
    ]
  }

  return [
    ...validateUnknownKeys(input, create ? PERSON_CREATE_KEYS : PERSON_PATCH_KEYS, path),
    ...validateRankedEntityFields(input, path, create),
    ...validateCreateTimestamps(input, path, create),
    ...validateOptionalNonEmptyString(input.photoFile, `${path}.photoFile`),
    ...validateOptionalPartialDate(input.birthDate, `${path}.birthDate`),
    ...validateOptionalPartialDate(input.deathDate, `${path}.deathDate`),
    ...validateOptionalEnumString(
      input.gender,
      `${path}.gender`,
      LIBRARY_GENDERS,
      'gender must be one of the supported gender values.'
    ),
    ...validateOptionalExternalIds(input.externalIds, `${path}.externalIds`)
  ]
}

function validateCompanyWriteInput(
  value: unknown,
  path: string,
  create: boolean
): ValidationIssue[] {
  const input = requireWriteObject(value, path, create ? 'Company create input' : 'Company patch')
  if (!input) {
    return [
      {
        path,
        message: create
          ? 'Company create input must be an object.'
          : 'Company patch must be an object.'
      }
    ]
  }

  return [
    ...validateUnknownKeys(input, create ? COMPANY_CREATE_KEYS : COMPANY_PATCH_KEYS, path),
    ...validateRankedEntityFields(input, path, create),
    ...validateCreateTimestamps(input, path, create),
    ...validateOptionalPartialDate(input.foundedDate, `${path}.foundedDate`),
    ...validateOptionalNonEmptyString(input.logoFile, `${path}.logoFile`),
    ...validateOptionalExternalIds(input.externalIds, `${path}.externalIds`)
  ]
}

function validateCharacterWriteInput(
  value: unknown,
  path: string,
  create: boolean
): ValidationIssue[] {
  const input = requireWriteObject(
    value,
    path,
    create ? 'Character create input' : 'Character patch'
  )
  if (!input) {
    return [
      {
        path,
        message: create
          ? 'Character create input must be an object.'
          : 'Character patch must be an object.'
      }
    ]
  }

  return [
    ...validateUnknownKeys(input, create ? CHARACTER_CREATE_KEYS : CHARACTER_PATCH_KEYS, path),
    ...validateRankedEntityFields(input, path, create),
    ...validateCreateTimestamps(input, path, create),
    ...validateOptionalNonEmptyString(input.photoFile, `${path}.photoFile`),
    ...validateOptionalPartialDate(input.birthDate, `${path}.birthDate`),
    ...validateOptionalEnumString(
      input.gender,
      `${path}.gender`,
      LIBRARY_GENDERS,
      'gender must be one of the supported gender values.'
    ),
    ...validateOptionalEnumString(
      input.bloodType,
      `${path}.bloodType`,
      LIBRARY_BLOOD_TYPES,
      'bloodType must be one of the supported blood types.'
    ),
    ...validateOptionalNonNegativeFiniteNumber(input.height, `${path}.height`),
    ...validateOptionalNonNegativeFiniteNumber(input.weight, `${path}.weight`),
    ...validateOptionalNonNegativeFiniteNumber(input.bust, `${path}.bust`),
    ...validateOptionalNonNegativeFiniteNumber(input.waist, `${path}.waist`),
    ...validateOptionalNonNegativeFiniteNumber(input.hips, `${path}.hips`),
    ...validateOptionalEnumString(
      input.cup,
      `${path}.cup`,
      LIBRARY_CUP_SIZES,
      'cup must be one of the supported cup sizes.'
    ),
    ...validateOptionalNonNegativeFiniteNumber(input.age, `${path}.age`),
    ...validateOptionalExternalIds(input.externalIds, `${path}.externalIds`)
  ]
}

function validateCollectionWriteInput(
  value: unknown,
  path: string,
  create: boolean
): ValidationIssue[] {
  const input = requireWriteObject(
    value,
    path,
    create ? 'Collection create input' : 'Collection patch'
  )
  if (!input) {
    return [
      {
        path,
        message: create
          ? 'Collection create input must be an object.'
          : 'Collection patch must be an object.'
      }
    ]
  }

  return [
    ...validateUnknownKeys(input, create ? COLLECTION_CREATE_KEYS : COLLECTION_PATCH_KEYS, path),
    ...validateEntityBaseFields(input, path, create),
    ...validateCreateTimestamps(input, path, create),
    ...validateOptionalNonEmptyString(input.coverFile, `${path}.coverFile`),
    ...validateOptionalBoolean(input.isNsfw, `${path}.isNsfw`),
    ...validateOptionalFiniteNumber(input.order, `${path}.order`, 'order must be a finite number.'),
    ...validateOptionalBoolean(input.isDynamic, `${path}.isDynamic`),
    ...validateOptionalDynamicCollectionConfig(input.dynamicConfig, `${path}.dynamicConfig`)
  ]
}

function validateTagWriteInput(value: unknown, path: string, create: boolean): ValidationIssue[] {
  const input = requireWriteObject(value, path, create ? 'Tag create input' : 'Tag patch')
  if (!input) {
    return [
      {
        path,
        message: create ? 'Tag create input must be an object.' : 'Tag patch must be an object.'
      }
    ]
  }

  return [
    ...validateUnknownKeys(input, create ? TAG_CREATE_KEYS : TAG_PATCH_KEYS, path),
    ...validateEntityBaseFields(input, path, create),
    ...validateCreateTimestamps(input, path, create),
    ...validateOptionalBoolean(input.isNsfw, `${path}.isNsfw`)
  ]
}

function validateCreateTimestamps(
  input: Record<string, unknown>,
  path: string,
  create: boolean
): ValidationIssue[] {
  if (!create) {
    return []
  }

  return [
    ...validateOptionalNonNegativeFiniteNumber(input.createdAt, `${path}.createdAt`),
    ...validateOptionalNonNegativeFiniteNumber(input.updatedAt, `${path}.updatedAt`)
  ]
}

function requireQueryObject(value: unknown): Record<string, unknown> | null {
  if (value === undefined) {
    return null
  }

  return isRecord(value) ? value : null
}

function validateBaseListQuery(
  query: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>
): ValidationIssue[] {
  return [
    ...validateUnknownKeys(query, allowedKeys),
    ...validateOptionalNonEmptyStringArray(query.ids, '$.ids'),
    ...validateOptionalString(query.search, '$.search'),
    ...validateOptionalNonNegativeInteger(query.limit, '$.limit'),
    ...validateOptionalNonNegativeInteger(query.offset, '$.offset'),
    ...validateSortQuery(query.sort, '$.sort')
  ]
}

function validateSortQuery(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (!isRecord(value)) {
    return [{ path, message: 'sort must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, SORT_QUERY_KEYS, path),
    ...validateRequiredString(value.field, `${path}.field`, {
      trim: true,
      valueMessage: 'sort.field must be a non-empty string.'
    }),
    ...validateOptionalEnumString(
      value.direction,
      `${path}.direction`,
      SORT_DIRECTIONS,
      'sort.direction must be "asc" or "desc".'
    )
  ]
}

function validateOptionalNonEmptyStringArray(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    return [{ path, message: 'Field must be an array of non-empty strings.' }]
  }

  const issues: ValidationIssue[] = []
  for (const [index, item] of value.entries()) {
    issues.push(
      ...validateRequiredString(item, `${path}[${index}]`, {
        trim: true,
        valueMessage: 'Array item must be a non-empty string.'
      })
    )
  }
  return issues
}

/** Season 0 is the specials season, so zero is a legitimate season number. */
function validateRequiredSeasonNumber(value: unknown, path: string): ValidationIssue[] {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return [{ path, message: 'seasonNumber must be an integer greater than or equal to zero.' }]
  }

  return []
}

function validateOptionalIntegerArray(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    return [{ path, message: 'Field must be an array of integers.' }]
  }

  const issues: ValidationIssue[] = []
  for (const [index, item] of value.entries()) {
    issues.push(
      ...validateOptionalInteger(item, `${path}[${index}]`, 'Array item must be an integer.')
    )
  }
  return issues
}

function validateOptionalEnumArray<TValue extends string>(
  value: unknown,
  path: string,
  allowedValues: readonly TValue[],
  message: string
): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    return [{ path, message }]
  }

  const issues: ValidationIssue[] = []
  for (const [index, item] of value.entries()) {
    issues.push(...validateRequiredEnumString(item, `${path}[${index}]`, allowedValues, message))
  }
  return issues
}
