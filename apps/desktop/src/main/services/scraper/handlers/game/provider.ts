/**
 * Game scraper provider runtime contract.
 */

import type { GameScraperSlot } from '@shared/db'
import type { Tag } from '@shared/metadata'
import type {
  GameSearchResult,
  ScrapedGameInfo,
  ScrapedGameCharacterFact,
  ScrapedGameCompanyFact,
  ScrapedGamePersonFact,
  ScraperCapability,
  ScraperLookup
} from '@shared/scraper'
import {
  type BaseScraperSession,
  type IdResolvedTarget,
  type ScraperProviderContext
} from '../../types'

export type GameResolvedTarget = IdResolvedTarget

export interface GameSessionResultMap {
  info: ScrapedGameInfo
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

  search(query: string, ctx: ScraperProviderContext): Promise<GameSearchResult[]>
  resolve(lookup: ScraperLookup, ctx: ScraperProviderContext): Promise<GameResolvedTarget | null>
  openSession(target: GameResolvedTarget, ctx: ScraperProviderContext): Promise<GameScraperSession>
}
