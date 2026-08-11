import {
  ALL_ENTITY_TYPES,
  CONTENT_ENTITY_TYPES,
  MEDIA_TYPES,
  type AllEntityType,
  type ContentEntityType,
  type MediaType
} from '../../common'
import { CONTENT_LOCALES, UI_LOCALES, type ContentLocale, type UiLocale } from '../../i18n'
import {
  SCANNER_INGEST_MODE_VALUES,
  SCANNER_PARALLEL_COUNT_DEFAULT,
  SCANNER_PARALLEL_COUNT_MAX,
  SCANNER_PARALLEL_COUNT_MIN
} from '../contracts/constants'
import type { AutomationCommandInvocationStatus } from '../../automation'
import {
  EXTENSION_INSTALL_REASON_VALUES,
  EXTENSION_REPOSITORY_STATE_VALUES,
  EXTENSION_SIGNER_ALGORITHM_VALUES,
  EXTENSION_UPDATE_POLICY_VALUES
} from '../contracts/enums'
import type {
  AnimeCharacterType,
  AnimeCompanyType,
  AnimeEpisodeType,
  AnimeExtraKind,
  AnimeFormat,
  AnimePersonType,
  AnimeRelationType,
  BloodType,
  CharacterPersonType,
  CupSize,
  ExtensionInstallReason,
  ExtensionRepositoryState,
  ExtensionSignerAlgorithm,
  ExtensionUpdatePolicy,
  GameCharacterType,
  GameCompanyType,
  GameLauncherMode,
  GameMonitorMode,
  GamePersonType,
  Gender,
  MainWindowCloseAction,
  ScannerIngestMode,
  Status
} from '../contracts/enums'
import { createBoundedIntegerType, createEnumType, createNullableEnumType } from './factories'

const STATUS_VALUES = [
  'notStarted',
  'inProgress',
  'partial',
  'completed',
  'multiple',
  'shelved'
] as const
export const status = createEnumType<Status>(STATUS_VALUES, 'notStarted', 'status')

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

const GAME_PERSON_TYPE_VALUES = [
  'director',
  'scenario',
  'illustration',
  'music',
  'programmer',
  'actor',
  'other'
] as const
export const gamePersonType = createEnumType<GamePersonType>(
  GAME_PERSON_TYPE_VALUES,
  'other',
  'gamePersonType'
)

const GAME_CHARACTER_TYPE_VALUES = ['main', 'supporting', 'cameo', 'other'] as const
export const gameCharacterType = createEnumType<GameCharacterType>(
  GAME_CHARACTER_TYPE_VALUES,
  'other',
  'gameCharacterType'
)

const GAME_COMPANY_TYPE_VALUES = ['developer', 'publisher', 'distributor', 'other'] as const
export const gameCompanyType = createEnumType<GameCompanyType>(
  GAME_COMPANY_TYPE_VALUES,
  'other',
  'gameCompanyType'
)

const CHARACTER_PERSON_TYPE_VALUES = ['actor', 'illustration', 'designer', 'other'] as const
export const characterPersonType = createEnumType<CharacterPersonType>(
  CHARACTER_PERSON_TYPE_VALUES,
  'other',
  'characterPersonType'
)

const ANIME_FORMAT_VALUES = ['tv', 'movie', 'ova', 'ona', 'special', 'other'] as const
export const animeFormat = createEnumType<AnimeFormat>(ANIME_FORMAT_VALUES, 'tv', 'animeFormat')

const ANIME_EPISODE_TYPE_VALUES = ['regular', 'special'] as const
export const animeEpisodeType = createEnumType<AnimeEpisodeType>(
  ANIME_EPISODE_TYPE_VALUES,
  'regular',
  'animeEpisodeType'
)

const ANIME_PERSON_TYPE_VALUES = [
  'director',
  'series',
  'scenario',
  'characterDesign',
  'music',
  'animationDirector',
  'other'
] as const
export const animePersonType = createEnumType<AnimePersonType>(
  ANIME_PERSON_TYPE_VALUES,
  'other',
  'animePersonType'
)

const ANIME_CHARACTER_TYPE_VALUES = ['main', 'supporting', 'cameo', 'other'] as const
export const animeCharacterType = createEnumType<AnimeCharacterType>(
  ANIME_CHARACTER_TYPE_VALUES,
  'other',
  'animeCharacterType'
)

const ANIME_COMPANY_TYPE_VALUES = ['studio', 'producer', 'distributor', 'other'] as const
export const animeCompanyType = createEnumType<AnimeCompanyType>(
  ANIME_COMPANY_TYPE_VALUES,
  'other',
  'animeCompanyType'
)

const ANIME_RELATION_TYPE_VALUES = [
  'sequel',
  'prequel',
  'sideStory',
  'movie',
  'summary',
  'alternative',
  'other'
] as const
export const animeRelationType = createEnumType<AnimeRelationType>(
  ANIME_RELATION_TYPE_VALUES,
  'other',
  'animeRelationType'
)

const ANIME_EXTRA_KIND_VALUES = ['trailer', 'pv', 'ncop', 'nced', 'interview', 'other'] as const
export const animeExtraKind = createEnumType<AnimeExtraKind>(
  ANIME_EXTRA_KIND_VALUES,
  'other',
  'animeExtraKind'
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
