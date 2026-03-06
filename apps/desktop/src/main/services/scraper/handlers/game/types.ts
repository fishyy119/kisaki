/**
 * Game Scraper Result Types
 *
 * Discriminated union types for provider results, organized by slot.
 */

import type { GameInfo, Tag } from '@shared/metadata'
import type {
  ScrapedGameCharacterFact,
  ScrapedGameCompanyFact,
  ScrapedGamePersonFact
} from '@shared/scraper'
import type { SlotResult } from '../../types'

export type GameScraperInfoResult = SlotResult<'info', GameInfo>
export type GameScraperTagsResult = SlotResult<'tags', Tag[]>
export type GameScraperCharactersResult = SlotResult<'characters', ScrapedGameCharacterFact[]>
export type GameScraperPersonsResult = SlotResult<'persons', ScrapedGamePersonFact[]>
export type GameScraperCompaniesResult = SlotResult<'companies', ScrapedGameCompanyFact[]>
export type GameScraperCoversResult = SlotResult<'covers', string[]>
export type GameScraperBackdropsResult = SlotResult<'backdrops', string[]>
export type GameScraperLogosResult = SlotResult<'logos', string[]>
export type GameScraperIconsResult = SlotResult<'icons', string[]>

export type GameScraperResult =
  | GameScraperInfoResult
  | GameScraperTagsResult
  | GameScraperCharactersResult
  | GameScraperPersonsResult
  | GameScraperCompaniesResult
  | GameScraperCoversResult
  | GameScraperBackdropsResult
  | GameScraperLogosResult
  | GameScraperIconsResult

export type GameScraperImageSlot = 'covers' | 'backdrops' | 'logos' | 'icons'

export type GameScraperImageResult =
  | GameScraperCoversResult
  | GameScraperBackdropsResult
  | GameScraperLogosResult
  | GameScraperIconsResult
