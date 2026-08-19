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
 * Staff credits plus `actor`: cast is per entry, because the same character is
 * recast between a series, its films and its remakes, and the character-person
 * link cannot say which entry a voice belongs to.
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

/** TV watch status; shows track the same wish/doing/done/on-hold/dropped states. */
export type TvStatus = 'planned' | 'watching' | 'completed' | 'onHold' | 'dropped'

/** TV status values in canonical display order. */
export const TV_STATUS_VALUES = [
  'planned',
  'watching',
  'completed',
  'onHold',
  'dropped'
] as const satisfies readonly TvStatus[]

/** TV production format */
export type TvFormat =
  'scripted' | 'miniseries' | 'documentary' | 'reality' | 'talkShow' | 'variety' | 'news' | 'other'

/** TV format values in canonical display order. */
export const TV_FORMAT_VALUES = [
  'scripted',
  'miniseries',
  'documentary',
  'reality',
  'talkShow',
  'variety',
  'news',
  'other'
] as const satisfies readonly TvFormat[]

/** TV-person link role */
export type TvPersonRole =
  | 'creator'
  | 'director'
  | 'writer'
  | 'producer'
  | 'music'
  | 'cinematography'
  | 'editing'
  | 'actor'
  | 'other'

/** TV-person role values in canonical display order. */
export const TV_PERSON_ROLE_VALUES = [
  'creator',
  'director',
  'writer',
  'producer',
  'music',
  'cinematography',
  'editing',
  'actor',
  'other'
] as const satisfies readonly TvPersonRole[]

/** TV-person crew roles, i.e. every role but the on-screen cast. */
export const TV_CREW_ROLE_VALUES = TV_PERSON_ROLE_VALUES.filter(
  (role) => role !== 'actor'
) as readonly TvPersonRole[]

/** TV-character link role */
export type TvCharacterRole = 'main' | 'supporting' | 'cameo' | 'other'

/** TV-character role values in canonical display order. */
export const TV_CHARACTER_ROLE_VALUES = [
  'main',
  'supporting',
  'cameo',
  'other'
] as const satisfies readonly TvCharacterRole[]

/** TV-company link role; broadcasters are a role shows have and films do not. */
export type TvCompanyRole = 'network' | 'studio' | 'producer' | 'distributor' | 'other'

/** TV-company role values in canonical display order. */
export const TV_COMPANY_ROLE_VALUES = [
  'network',
  'studio',
  'producer',
  'distributor',
  'other'
] as const satisfies readonly TvCompanyRole[]

/** Supplementary TV asset type; these never carry watch state. */
export type TvExtraType =
  'trailer' | 'teaser' | 'behindTheScenes' | 'featurette' | 'deletedScene' | 'interview' | 'other'

/** TV extra type values in canonical display order. */
export const TV_EXTRA_TYPE_VALUES = [
  'trailer',
  'teaser',
  'behindTheScenes',
  'featurette',
  'deletedScene',
  'interview',
  'other'
] as const satisfies readonly TvExtraType[]

/** Movie watch status; a film is one unit, so the same states still apply. */
export type MovieStatus = 'planned' | 'watching' | 'completed' | 'onHold' | 'dropped'

/** Movie status values in canonical display order. */
export const MOVIE_STATUS_VALUES = [
  'planned',
  'watching',
  'completed',
  'onHold',
  'dropped'
] as const satisfies readonly MovieStatus[]

/** Movie release format */
export type MovieFormat = 'theatrical' | 'documentary' | 'short' | 'tvMovie' | 'other'

/** Movie format values in canonical display order. */
export const MOVIE_FORMAT_VALUES = [
  'theatrical',
  'documentary',
  'short',
  'tvMovie',
  'other'
] as const satisfies readonly MovieFormat[]

/** Movie-person link role */
export type MoviePersonRole =
  'director' | 'writer' | 'producer' | 'music' | 'cinematography' | 'editing' | 'actor' | 'other'

/** Movie-person role values in canonical display order. */
export const MOVIE_PERSON_ROLE_VALUES = [
  'director',
  'writer',
  'producer',
  'music',
  'cinematography',
  'editing',
  'actor',
  'other'
] as const satisfies readonly MoviePersonRole[]

/** Movie-person crew roles, i.e. every role but the on-screen cast. */
export const MOVIE_CREW_ROLE_VALUES = MOVIE_PERSON_ROLE_VALUES.filter(
  (role) => role !== 'actor'
) as readonly MoviePersonRole[]

/** Movie-character link role */
export type MovieCharacterRole = 'main' | 'supporting' | 'cameo' | 'other'

/** Movie-character role values in canonical display order. */
export const MOVIE_CHARACTER_ROLE_VALUES = [
  'main',
  'supporting',
  'cameo',
  'other'
] as const satisfies readonly MovieCharacterRole[]

/** Movie-company link role */
export type MovieCompanyRole = 'studio' | 'producer' | 'distributor' | 'other'

/** Movie-company role values in canonical display order. */
export const MOVIE_COMPANY_ROLE_VALUES = [
  'studio',
  'producer',
  'distributor',
  'other'
] as const satisfies readonly MovieCompanyRole[]

/** Supplementary movie asset type; these never carry watch state. */
export type MovieExtraType =
  'trailer' | 'teaser' | 'behindTheScenes' | 'featurette' | 'deletedScene' | 'interview' | 'other'

/** Movie extra type values in canonical display order. */
export const MOVIE_EXTRA_TYPE_VALUES = [
  'trailer',
  'teaser',
  'behindTheScenes',
  'featurette',
  'deletedScene',
  'interview',
  'other'
] as const satisfies readonly MovieExtraType[]

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
