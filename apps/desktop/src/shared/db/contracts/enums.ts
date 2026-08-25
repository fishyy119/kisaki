/**
 * Database enum types
 *
 * Database enum type definitions and shared value lists.
 * Drizzle customType implementations are in ../columns.
 */

import { SCANNER_INGEST_MODE_VALUES } from './constants'

/** Game completion status */
export type GameStatus =
  'notStarted' | 'inProgress' | 'partial' | 'completed' | 'multiple' | 'shelved'

/** Game status values in canonical display order. */
export const GAME_STATUS_VALUES = [
  'notStarted',
  'inProgress',
  'partial',
  'completed',
  'multiple',
  'shelved'
] as const satisfies readonly GameStatus[]

/** Anime watch status; mirrors the wish/doing/done/on-hold/dropped collection vocabulary. */
export type AnimeStatus = 'planned' | 'watching' | 'completed' | 'onHold' | 'dropped'

/** Anime status values in canonical display order. */
export const ANIME_STATUS_VALUES = [
  'planned',
  'watching',
  'completed',
  'onHold',
  'dropped'
] as const satisfies readonly AnimeStatus[]

/** Comic reading status; mirrors the wish/doing/done/on-hold/dropped collection vocabulary. */
export type ComicStatus = 'planned' | 'reading' | 'completed' | 'onHold' | 'dropped'

/** Comic status values in canonical display order. */
export const COMIC_STATUS_VALUES = [
  'planned',
  'reading',
  'completed',
  'onHold',
  'dropped'
] as const satisfies readonly ComicStatus[]

/** Novel reading status; mirrors the wish/doing/done/on-hold/dropped collection vocabulary. */
export type NovelStatus = 'planned' | 'reading' | 'completed' | 'onHold' | 'dropped'

/** Novel status values in canonical display order. */
export const NOVEL_STATUS_VALUES = [
  'planned',
  'reading',
  'completed',
  'onHold',
  'dropped'
] as const satisfies readonly NovelStatus[]

/** Game launcher mode */
export type GameLauncherMode = 'file' | 'url' | 'exec'

/** Game process monitor mode */
export type GameMonitorMode = 'file' | 'folder' | 'process'

/** Person gender */
export type Gender = 'male' | 'female' | 'other'

/** Game-person link role */
export type GamePersonRole =
  'director' | 'scenario' | 'illustration' | 'music' | 'programmer' | 'actor' | 'other'

/** Game-person role values in canonical display order. */
export const GAME_PERSON_ROLE_VALUES = [
  'director',
  'scenario',
  'illustration',
  'music',
  'programmer',
  'actor',
  'other'
] as const satisfies readonly GamePersonRole[]

/** Game-character link role */
export type GameCharacterRole = 'main' | 'supporting' | 'cameo' | 'other'

/** Game-character role values in canonical display order. */
export const GAME_CHARACTER_ROLE_VALUES = [
  'main',
  'supporting',
  'cameo',
  'other'
] as const satisfies readonly GameCharacterRole[]

/** Game-company link role */
export type GameCompanyRole = 'developer' | 'publisher' | 'distributor' | 'other'

/** Game-company role values in canonical display order. */
export const GAME_COMPANY_ROLE_VALUES = [
  'developer',
  'publisher',
  'distributor',
  'other'
] as const satisfies readonly GameCompanyRole[]

/** Character-person link role */
export type CharacterPersonRole = 'actor' | 'illustration' | 'designer' | 'other'

/** Character-person role values in canonical display order. */
export const CHARACTER_PERSON_ROLE_VALUES = [
  'actor',
  'illustration',
  'designer',
  'other'
] as const satisfies readonly CharacterPersonRole[]

/** Anime release format */
export type AnimeFormat = 'tv' | 'movie' | 'ova' | 'ona' | 'special' | 'other'

/** Anime format values in canonical display order. */
export const ANIME_FORMAT_VALUES = [
  'tv',
  'movie',
  'ova',
  'ona',
  'special',
  'other'
] as const satisfies readonly AnimeFormat[]

/**
 * Anime episode kind.
 *
 * Only episodes worth tracking individually are stored; openings, endings and
 * trailers are extras, not episodes.
 */
export type AnimeEpisodeType = 'regular' | 'special'

/** Anime episode type values in canonical display order. */
export const ANIME_EPISODE_TYPE_VALUES = [
  'regular',
  'special'
] as const satisfies readonly AnimeEpisodeType[]

/**
 * Anime-person link role.
 *
 * Staff credits plus `actor`, which states that a person is credited in this
 * entry at all; which characters they voice there is a separate three-way fact
 * held by `anime_cast_links`.
 */
export type AnimePersonRole =
  | 'originalCreator'
  | 'director'
  | 'seriesComposition'
  | 'scenario'
  | 'episodeDirector'
  | 'characterDesign'
  | 'animationDirector'
  | 'animation'
  | 'art'
  | 'photography'
  | 'sound'
  | 'music'
  | 'producer'
  | 'actor'
  | 'other'

/** Anime-person role values in canonical display order. */
export const ANIME_PERSON_ROLE_VALUES = [
  'originalCreator',
  'director',
  'seriesComposition',
  'scenario',
  'episodeDirector',
  'characterDesign',
  'animationDirector',
  'animation',
  'art',
  'photography',
  'sound',
  'music',
  'producer',
  'actor',
  'other'
] as const satisfies readonly AnimePersonRole[]

/** Anime-character link role */
export type AnimeCharacterRole = 'main' | 'supporting' | 'cameo' | 'other'

/** Anime-character role values in canonical display order. */
export const ANIME_CHARACTER_ROLE_VALUES = [
  'main',
  'supporting',
  'cameo',
  'other'
] as const satisfies readonly AnimeCharacterRole[]

/** Anime-company link role */
export type AnimeCompanyRole = 'studio' | 'producer' | 'distributor' | 'other'

/** Anime-company role values in canonical display order. */
export const ANIME_COMPANY_ROLE_VALUES = [
  'studio',
  'producer',
  'distributor',
  'other'
] as const satisfies readonly AnimeCompanyRole[]

/** Supplementary anime asset type; these never carry watch state. */
export type AnimeExtraType = 'trailer' | 'pv' | 'ncop' | 'nced' | 'interview' | 'other'

/** Anime extra type values in canonical display order. */
export const ANIME_EXTRA_TYPE_VALUES = [
  'trailer',
  'pv',
  'ncop',
  'nced',
  'interview',
  'other'
] as const satisfies readonly AnimeExtraType[]

/**
 * Comic release format.
 *
 * A publication-identity label, not a genre: overlapping identities resolve to
 * the most specific one (a Korean long-strip work is `webtoon`, not `manhwa`;
 * a fan work is `doujinshi`). `webtoon` is the only value that changes the
 * reader's default layout (vertical scroll).
 */
export type ComicFormat = 'manga' | 'manhua' | 'manhwa' | 'webtoon' | 'doujinshi' | 'other'

/** Comic format values in canonical display order. */
export const COMIC_FORMAT_VALUES = [
  'manga',
  'manhua',
  'manhwa',
  'webtoon',
  'doujinshi',
  'other'
] as const satisfies readonly ComicFormat[]

/** Novel release format: publication form of narrative fiction. */
export type NovelFormat = 'lightNovel' | 'webNovel' | 'general' | 'other'

/** Novel format values in canonical display order. */
export const NOVEL_FORMAT_VALUES = [
  'lightNovel',
  'webNovel',
  'general',
  'other'
] as const satisfies readonly NovelFormat[]

/**
 * Page progression / layout of a comic entry.
 *
 * Stored as a per-entry override; a null column follows the format default
 * (`webtoon` format scrolls, everything else pages right-to-left for manga
 * and left-to-right otherwise).
 */
export type ComicReadingDirection = 'rtl' | 'ltr' | 'vertical'

/** Comic reading direction values in canonical display order. */
export const COMIC_READING_DIRECTION_VALUES = [
  'rtl',
  'ltr',
  'vertical'
] as const satisfies readonly ComicReadingDirection[]

/**
 * Comic-person link role.
 *
 * `author` is the single-credit form (story and art by one hand); split
 * credits use `originalCreator` (story) plus `art`.
 */
export type ComicPersonRole = 'author' | 'originalCreator' | 'art' | 'other'

/** Comic-person role values in canonical display order. */
export const COMIC_PERSON_ROLE_VALUES = [
  'author',
  'originalCreator',
  'art',
  'other'
] as const satisfies readonly ComicPersonRole[]

/** Comic-character link role */
export type ComicCharacterRole = 'main' | 'supporting' | 'cameo' | 'other'

/** Comic-character role values in canonical display order. */
export const COMIC_CHARACTER_ROLE_VALUES = [
  'main',
  'supporting',
  'cameo',
  'other'
] as const satisfies readonly ComicCharacterRole[]

/** Comic-company link role; `imprint` is the publishing line, such as Jump Comics. */
export type ComicCompanyRole = 'publisher' | 'imprint' | 'other'

/** Comic-company role values in canonical display order. */
export const COMIC_COMPANY_ROLE_VALUES = [
  'publisher',
  'imprint',
  'other'
] as const satisfies readonly ComicCompanyRole[]

/**
 * Novel-person link role.
 *
 * `originalCreator` covers spin-off novels crediting the source work's
 * creator; the novel's own writer is `author`.
 */
export type NovelPersonRole = 'author' | 'illustrator' | 'originalCreator' | 'other'

/** Novel-person role values in canonical display order. */
export const NOVEL_PERSON_ROLE_VALUES = [
  'author',
  'illustrator',
  'originalCreator',
  'other'
] as const satisfies readonly NovelPersonRole[]

/** Novel-character link role */
export type NovelCharacterRole = 'main' | 'supporting' | 'cameo' | 'other'

/** Novel-character role values in canonical display order. */
export const NOVEL_CHARACTER_ROLE_VALUES = [
  'main',
  'supporting',
  'cameo',
  'other'
] as const satisfies readonly NovelCharacterRole[]

/** Novel-company link role; `imprint` is the publishing line, such as Dengeki Bunko. */
export type NovelCompanyRole = 'publisher' | 'imprint' | 'other'

/** Novel-company role values in canonical display order. */
export const NOVEL_COMPANY_ROLE_VALUES = [
  'publisher',
  'imprint',
  'other'
] as const satisfies readonly NovelCompanyRole[]

/** Blood type */
export type BloodType = 'a' | 'b' | 'ab' | 'o'

/** Cup size (for female characters) */
export type CupSize = 'aaa' | 'aa' | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k'

/** Main window close button behavior */
export type MainWindowCloseAction = 'exit' | 'tray'

/** Scanner ingest mode */
export type ScannerIngestMode = (typeof SCANNER_INGEST_MODE_VALUES)[number]

/** Extension repository state */
export const EXTENSION_REPOSITORY_STATE_VALUES = ['enabled', 'disabled'] as const
export type ExtensionRepositoryState = (typeof EXTENSION_REPOSITORY_STATE_VALUES)[number]

/** Why an extension package was installed. */
export const EXTENSION_INSTALL_REASON_VALUES = ['manual', 'update', 'local-file'] as const
export type ExtensionInstallReason = (typeof EXTENSION_INSTALL_REASON_VALUES)[number]

/** Extension update policy persisted for an installation. */
export const EXTENSION_UPDATE_POLICY_VALUES = ['manual', 'auto', 'pinned'] as const
export type ExtensionUpdatePolicy = (typeof EXTENSION_UPDATE_POLICY_VALUES)[number]

/** Supported extension signer algorithms. */
export const EXTENSION_SIGNER_ALGORITHM_VALUES = ['ed25519'] as const
export type ExtensionSignerAlgorithm = (typeof EXTENSION_SIGNER_ALGORITHM_VALUES)[number]
