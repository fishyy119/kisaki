/**
 * Game scraper provider runtime contract.
 */

import type { GameScraperSlot } from '@shared/db'
import type { GameInfo, Tag } from '@shared/metadata'
import type { Locale } from '@shared/locale'
import type {
  GameSearchResult,
  ScrapedGameCharacterFact,
  ScrapedGameCompanyFact,
  ScrapedGamePersonFact,
  ScraperCapability,
  ScraperLookup
} from '@shared/scraper'
import { type BaseScraperSession, type IdResolvedTarget } from '../../types'

export type GameResolvedTarget = IdResolvedTarget

export interface GameSessionResultMap {
  info: GameInfo
  tags: Tag[]
  characters: ScrapedGameCharacterFact[]
  persons: ScrapedGamePersonFact[]
  companies: ScrapedGameCompanyFact[]
  covers: string[]
  backdrops: string[]
  logos: string[]
  icons: string[]
}

export type GameScraperSession = BaseScraperSession<GameScraperSlot, GameSessionResultMap>

export interface GameScraperProvider {
  readonly id: string
  readonly name: string
  readonly externalIdSource: string
  readonly capabilities: readonly ScraperCapability[]

  search(query: string, locale?: Locale): Promise<GameSearchResult[]>
  resolve(lookup: ScraperLookup, locale: Locale): Promise<GameResolvedTarget | null>
  openSession(target: GameResolvedTarget, locale: Locale): Promise<GameScraperSession>
}
