/**
 * Database enum types
 *
 * Database enum type definitions and shared value lists.
 * Drizzle customType implementations are in ../columns.
 */

import { SCANNER_INGEST_MODE_VALUES } from './constants'

/** Game/media completion status */
export type Status = 'notStarted' | 'inProgress' | 'partial' | 'completed' | 'multiple' | 'shelved'

/** Game launcher mode */
export type GameLauncherMode = 'file' | 'url' | 'exec'

/** Game process monitor mode */
export type GameMonitorMode = 'file' | 'folder' | 'process'

/** Person gender */
export type Gender = 'male' | 'female' | 'other'

/** Game-person link role */
export type GamePersonRole =
  'director' | 'scenario' | 'illustration' | 'music' | 'programmer' | 'actor' | 'other'

/** Game-character link role */
export type GameCharacterRole = 'main' | 'supporting' | 'cameo' | 'other'

/** Game-company link role */
export type GameCompanyRole = 'developer' | 'publisher' | 'distributor' | 'other'

/** Character-person link role */
export type CharacterPersonRole = 'actor' | 'illustration' | 'designer' | 'other'

/** Anime release format */
export type AnimeFormat = 'tv' | 'movie' | 'ova' | 'ona' | 'special' | 'other'

/**
 * Anime episode kind.
 *
 * Only episodes worth tracking individually are stored; openings, endings and
 * trailers are extras, not episodes.
 */
export type AnimeEpisodeType = 'regular' | 'special'

/** Anime-person link role */
export type AnimePersonRole =
  | 'director'
  | 'series'
  | 'scenario'
  | 'characterDesign'
  | 'music'
  | 'animationDirector'
  | 'other'

/** Anime-character link role */
export type AnimeCharacterRole = 'main' | 'supporting' | 'cameo' | 'other'

/** Anime-company link role */
export type AnimeCompanyRole = 'studio' | 'producer' | 'distributor' | 'other'

/** Supplementary anime asset kind; these never carry watch state. */
export type AnimeExtraKind = 'trailer' | 'pv' | 'ncop' | 'nced' | 'interview' | 'other'

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
