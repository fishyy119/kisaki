/**
 * Shared database constants
 *
 * Export only cross-file constants here.
 * File-local implementation details should stay in their original modules.
 */

import type {
  AnimeScraperSlot,
  CharacterScraperSlot,
  ComicScraperSlot,
  CompanyScraperSlot,
  GameScraperSlot,
  NovelScraperSlot,
  PersonScraperSlot
} from './json'

export const SCANNER_INGEST_MODE_VALUES = [
  'prefer-scraper',
  'require-scraper',
  'direct-only'
] as const

export const GAME_SCRAPER_SLOTS: GameScraperSlot[] = [
  'info',
  'tags',
  'characters',
  'persons',
  'companies',
  'relatedEntries',
  'covers',
  'backdrops',
  'logos',
  'icons'
]

export const ANIME_SCRAPER_SLOTS: AnimeScraperSlot[] = [
  'info',
  'tags',
  'episodes',
  'characters',
  'persons',
  'companies',
  'relatedEntries',
  'covers',
  'backdrops',
  'logos'
]

export const COMIC_SCRAPER_SLOTS: ComicScraperSlot[] = [
  'info',
  'tags',
  'chapters',
  'characters',
  'persons',
  'companies',
  'relatedEntries',
  'covers',
  'backdrops',
  'logos'
]

export const NOVEL_SCRAPER_SLOTS: NovelScraperSlot[] = [
  'info',
  'tags',
  'volumes',
  'characters',
  'persons',
  'companies',
  'relatedEntries',
  'covers',
  'backdrops',
  'logos'
]

export const PERSON_SCRAPER_SLOTS: PersonScraperSlot[] = ['info', 'tags', 'photos']

export const COMPANY_SCRAPER_SLOTS: CompanyScraperSlot[] = ['info', 'tags', 'logos']

export const CHARACTER_SCRAPER_SLOTS: CharacterScraperSlot[] = ['info', 'tags', 'persons', 'photos']

export const SCANNER_PARALLEL_COUNT_MIN = 1
export const SCANNER_PARALLEL_COUNT_MAX = 16
export const SCANNER_PARALLEL_COUNT_DEFAULT = 1
