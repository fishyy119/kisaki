/**
 * Database enum types
 *
 * Database enum type definitions and shared value lists.
 * Drizzle customType implementations are in ./custom-types.ts.
 */

/** Game/media completion status */
export type Status = 'notStarted' | 'inProgress' | 'partial' | 'completed' | 'multiple' | 'shelved'

/** Game launcher mode */
export type GameLauncherMode = 'file' | 'url' | 'exec'

/** Game process monitor mode */
export type GameMonitorMode = 'file' | 'folder' | 'process'

/** Person gender */
export type Gender = 'male' | 'female' | 'other'

/** Game-Person relationship type */
export type GamePersonType =
  | 'director'
  | 'scenario'
  | 'illustration'
  | 'music'
  | 'programmer'
  | 'actor'
  | 'other'

/** Game-Character relationship type */
export type GameCharacterType = 'main' | 'supporting' | 'cameo' | 'other'

/** Game-Company relationship type */
export type GameCompanyType = 'developer' | 'publisher' | 'distributor' | 'other'

/** Character-Person relationship type */
export type CharacterPersonType = 'actor' | 'illustration' | 'designer' | 'other'

/** Blood type */
export type BloodType = 'a' | 'b' | 'ab' | 'o'

/** Cup size (for female characters) */
export type CupSize = 'aaa' | 'aa' | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k'

/** Main window close button behavior */
export type MainWindowCloseAction = 'exit' | 'tray'

/** Scanner ingest mode */
export const SCANNER_INGEST_MODE_VALUES = [
  'prefer-scraper',
  'require-scraper',
  'direct-only'
] as const

export type ScannerIngestMode = (typeof SCANNER_INGEST_MODE_VALUES)[number]
