import {
  ALL_ENTITY_TYPES,
  CONTENT_ENTITY_TYPES,
  MEDIA_TYPES,
  type AllEntityType,
  type ContentEntityType,
  type MediaType
} from '../../common'
import { MEDIA_RELATION_TYPES, type MediaRelationType } from '../contracts/media-relations'
import { CONTENT_LOCALES, UI_LOCALES, type ContentLocale, type UiLocale } from '../../i18n'
import {
  SCANNER_INGEST_MODE_VALUES,
  SCANNER_PARALLEL_COUNT_DEFAULT,
  SCANNER_PARALLEL_COUNT_MAX,
  SCANNER_PARALLEL_COUNT_MIN
} from '../contracts/constants'
import type { AutomationCommandInvocationStatus } from '../../automation'
import {
  ANIME_CHARACTER_ROLE_VALUES,
  ANIME_COMPANY_ROLE_VALUES,
  ANIME_EPISODE_TYPE_VALUES,
  ANIME_EXTRA_TYPE_VALUES,
  ANIME_FORMAT_VALUES,
  ANIME_PERSON_ROLE_VALUES,
  ANIME_STATUS_VALUES,
  CHARACTER_PERSON_ROLE_VALUES,
  EXTENSION_INSTALL_REASON_VALUES,
  EXTENSION_REPOSITORY_STATE_VALUES,
  EXTENSION_SIGNER_ALGORITHM_VALUES,
  EXTENSION_UPDATE_POLICY_VALUES,
  GAME_CHARACTER_ROLE_VALUES,
  GAME_COMPANY_ROLE_VALUES,
  GAME_PERSON_ROLE_VALUES,
  GAME_STATUS_VALUES,
  MOVIE_CHARACTER_ROLE_VALUES,
  MOVIE_COMPANY_ROLE_VALUES,
  MOVIE_EXTRA_TYPE_VALUES,
  MOVIE_FORMAT_VALUES,
  MOVIE_PERSON_ROLE_VALUES,
  MOVIE_STATUS_VALUES,
  TV_CHARACTER_ROLE_VALUES,
  TV_COMPANY_ROLE_VALUES,
  TV_EXTRA_TYPE_VALUES,
  TV_FORMAT_VALUES,
  TV_PERSON_ROLE_VALUES,
  TV_STATUS_VALUES
} from '../contracts/enums'
import type {
  AnimeCharacterRole,
  AnimeCompanyRole,
  AnimeEpisodeType,
  AnimeExtraType,
  AnimeFormat,
  AnimePersonRole,
  AnimeStatus,
  BloodType,
  CharacterPersonRole,
  CupSize,
  ExtensionInstallReason,
  ExtensionRepositoryState,
  ExtensionSignerAlgorithm,
  ExtensionUpdatePolicy,
  GameCharacterRole,
  GameCompanyRole,
  GameLauncherMode,
  GameMonitorMode,
  GamePersonRole,
  GameStatus,
  Gender,
  MainWindowCloseAction,
  MovieCharacterRole,
  MovieCompanyRole,
  MovieExtraType,
  MovieFormat,
  MoviePersonRole,
  MovieStatus,
  ScannerIngestMode,
  TvCharacterRole,
  TvCompanyRole,
  TvExtraType,
  TvFormat,
  TvPersonRole,
  TvStatus
} from '../contracts/enums'
import { createBoundedIntegerType, createEnumType, createNullableEnumType } from './factories'

export const gameStatus = createEnumType<GameStatus>(GAME_STATUS_VALUES, 'notStarted', 'gameStatus')

export const animeStatus = createEnumType<AnimeStatus>(
  ANIME_STATUS_VALUES,
  'planned',
  'animeStatus'
)

const GAME_LAUNCHER_MODE_VALUES = ['file', 'url', 'exec'] as const
export const gameLauncherMode = createEnumType<GameLauncherMode>(
  GAME_LAUNCHER_MODE_VALUES,
  'file',
  'gameLauncherMode'
)

const GAME_MONITOR_MODE_VALUES = ['file', 'folder', 'process'] as const
export const gameMonitorMode = createEnumType<GameMonitorMode>(
  GAME_MONITOR_MODE_VALUES,
  'folder',
  'gameMonitorMode'
)

const GENDER_VALUES = ['male', 'female', 'other'] as const
export const gender = createNullableEnumType<Gender>(GENDER_VALUES, 'gender')

export const gamePersonRole = createEnumType<GamePersonRole>(
  GAME_PERSON_ROLE_VALUES,
  'other',
  'gamePersonRole'
)

export const gameCharacterRole = createEnumType<GameCharacterRole>(
  GAME_CHARACTER_ROLE_VALUES,
  'other',
  'gameCharacterRole'
)

export const gameCompanyRole = createEnumType<GameCompanyRole>(
  GAME_COMPANY_ROLE_VALUES,
  'other',
  'gameCompanyRole'
)

export const characterPersonRole = createEnumType<CharacterPersonRole>(
  CHARACTER_PERSON_ROLE_VALUES,
  'other',
  'characterPersonRole'
)

export const animeFormat = createEnumType<AnimeFormat>(ANIME_FORMAT_VALUES, 'tv', 'animeFormat')

export const animeEpisodeType = createEnumType<AnimeEpisodeType>(
  ANIME_EPISODE_TYPE_VALUES,
  'regular',
  'animeEpisodeType'
)

export const animePersonRole = createEnumType<AnimePersonRole>(
  ANIME_PERSON_ROLE_VALUES,
  'other',
  'animePersonRole'
)

export const animeCharacterRole = createEnumType<AnimeCharacterRole>(
  ANIME_CHARACTER_ROLE_VALUES,
  'other',
  'animeCharacterRole'
)

export const animeCompanyRole = createEnumType<AnimeCompanyRole>(
  ANIME_COMPANY_ROLE_VALUES,
  'other',
  'animeCompanyRole'
)

export const animeExtraType = createEnumType<AnimeExtraType>(
  ANIME_EXTRA_TYPE_VALUES,
  'other',
  'animeExtraType'
)

export const tvStatus = createEnumType<TvStatus>(TV_STATUS_VALUES, 'planned', 'tvStatus')

export const tvFormat = createEnumType<TvFormat>(TV_FORMAT_VALUES, 'scripted', 'tvFormat')

export const tvPersonRole = createEnumType<TvPersonRole>(
  TV_PERSON_ROLE_VALUES,
  'other',
  'tvPersonRole'
)

export const tvCharacterRole = createEnumType<TvCharacterRole>(
  TV_CHARACTER_ROLE_VALUES,
  'other',
  'tvCharacterRole'
)

export const tvCompanyRole = createEnumType<TvCompanyRole>(
  TV_COMPANY_ROLE_VALUES,
  'other',
  'tvCompanyRole'
)

export const tvExtraType = createEnumType<TvExtraType>(TV_EXTRA_TYPE_VALUES, 'other', 'tvExtraType')

export const movieStatus = createEnumType<MovieStatus>(
  MOVIE_STATUS_VALUES,
  'planned',
  'movieStatus'
)

export const movieFormat = createEnumType<MovieFormat>(
  MOVIE_FORMAT_VALUES,
  'theatrical',
  'movieFormat'
)

export const moviePersonRole = createEnumType<MoviePersonRole>(
  MOVIE_PERSON_ROLE_VALUES,
  'other',
  'moviePersonRole'
)

export const movieCharacterRole = createEnumType<MovieCharacterRole>(
  MOVIE_CHARACTER_ROLE_VALUES,
  'other',
  'movieCharacterRole'
)

export const movieCompanyRole = createEnumType<MovieCompanyRole>(
  MOVIE_COMPANY_ROLE_VALUES,
  'other',
  'movieCompanyRole'
)

export const movieExtraType = createEnumType<MovieExtraType>(
  MOVIE_EXTRA_TYPE_VALUES,
  'other',
  'movieExtraType'
)

const BLOOD_TYPE_VALUES = ['a', 'b', 'ab', 'o'] as const
export const bloodType = createNullableEnumType<BloodType>(BLOOD_TYPE_VALUES, 'bloodType')

const CUP_SIZE_VALUES = [
  'aaa',
  'aa',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k'
] as const
export const cupSize = createNullableEnumType<CupSize>(CUP_SIZE_VALUES, 'cupSize')

export const mediaType = createEnumType<MediaType>(MEDIA_TYPES, 'game', 'mediaType')

export const mediaRelationType = createEnumType<MediaRelationType>(
  MEDIA_RELATION_TYPES,
  'other',
  'mediaRelationType'
)
export const contentLocale = createNullableEnumType<ContentLocale>(CONTENT_LOCALES, 'contentLocale')
export const uiLocale = createNullableEnumType<UiLocale>(UI_LOCALES, 'uiLocale')

const MAIN_WINDOW_CLOSE_ACTION_VALUES = ['exit', 'tray'] as const
export const mainWindowCloseAction = createEnumType<MainWindowCloseAction>(
  MAIN_WINDOW_CLOSE_ACTION_VALUES,
  'exit',
  'mainWindowCloseAction'
)

export const scannerIngestMode = createEnumType<ScannerIngestMode>(
  SCANNER_INGEST_MODE_VALUES,
  'prefer-scraper',
  'scannerIngestMode'
)

export const scannerParallelCount = createBoundedIntegerType(
  SCANNER_PARALLEL_COUNT_MIN,
  SCANNER_PARALLEL_COUNT_MAX,
  SCANNER_PARALLEL_COUNT_DEFAULT,
  'scannerParallelCount'
)

export const contentEntityType = createEnumType<ContentEntityType>(
  CONTENT_ENTITY_TYPES,
  'game',
  'contentEntityType'
)

export const allEntityType = createEnumType<AllEntityType>(
  ALL_ENTITY_TYPES,
  'game',
  'allEntityType'
)

const SECTION_LAYOUT_VALUES = ['horizontal', 'grid'] as const
export const sectionLayout = createEnumType(SECTION_LAYOUT_VALUES, 'horizontal', 'sectionLayout')

const SECTION_ITEM_SIZE_VALUES = ['xs', 'sm', 'md', 'lg', 'xl'] as const
export const sectionItemSize = createEnumType(SECTION_ITEM_SIZE_VALUES, 'md', 'sectionItemSize')

const SECTION_OPEN_MODE_VALUES = ['page', 'dialog'] as const
export const sectionOpenMode = createEnumType(SECTION_OPEN_MODE_VALUES, 'page', 'sectionOpenMode')

const SORT_DIRECTION_VALUES = ['asc', 'desc'] as const
export const sortDirection = createEnumType(SORT_DIRECTION_VALUES, 'asc', 'sortDirection')

const AUTOMATION_COMMAND_INVOCATION_STATUS_VALUES = ['completed', 'failed'] as const
export const automationCommandInvocationStatus = createEnumType<AutomationCommandInvocationStatus>(
  AUTOMATION_COMMAND_INVOCATION_STATUS_VALUES,
  'completed',
  'automationCommandInvocationStatus'
)

export const extensionRepositoryState = createEnumType<ExtensionRepositoryState>(
  EXTENSION_REPOSITORY_STATE_VALUES,
  'disabled',
  'extensionRepositoryState'
)

export const extensionInstallReason = createEnumType<ExtensionInstallReason>(
  EXTENSION_INSTALL_REASON_VALUES,
  'manual',
  'extensionInstallReason'
)

export const extensionUpdatePolicy = createEnumType<ExtensionUpdatePolicy>(
  EXTENSION_UPDATE_POLICY_VALUES,
  'manual',
  'extensionUpdatePolicy'
)

export const extensionSignerAlgorithm = createEnumType<ExtensionSignerAlgorithm>(
  EXTENSION_SIGNER_ALGORITHM_VALUES,
  'ed25519',
  'extensionSignerAlgorithm'
)
