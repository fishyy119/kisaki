/**
 * Game scraper provider runtime contract.
 */

import type { GameScraperSlot } from '@shared/db'
import type { Tag } from '@shared/metadata'
import type { ContentLocale } from '@shared/i18n'
import type {
  GameSearchResult,
  ScrapedGameInfo,
  ScrapedGameCharacterFact,
  ScrapedGameCompanyFact,
  ScrapedGamePersonFact,
  ScraperCapability,
  ScraperLookup
} from '@shared/scraper'
import { type BaseScraperSession, type IdResolvedTarget } from '../../types'

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

  search(query: string, locale?: ContentLocale): Promise<GameSearchResult[]>
  resolve(lookup: ScraperLookup, locale: ContentLocale): Promise<GameResolvedTarget | null>
  openSession(target: GameResolvedTarget, locale: ContentLocale): Promise<GameScraperSession>
}
