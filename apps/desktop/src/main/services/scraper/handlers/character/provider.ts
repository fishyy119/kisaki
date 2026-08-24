/**
 * Character scraper provider runtime contract.
 */

import type { CharacterScraperSlot } from '@shared/db'
import type { Tag } from '@shared/metadata'
import type {
  CharacterSearchResult,
  ScrapedCharacterInfo,
  ScrapedCharacterPersonFact,
  ScraperCapability,
  ScraperLookup
} from '@shared/scraper'
import {
  type BaseScraperSession,
  type IdResolvedTarget,
  type ScraperProviderContext
} from '../../types'

export type CharacterResolvedTarget = IdResolvedTarget

export interface CharacterSessionResultMap {
  info: ScrapedCharacterInfo
  tags: Tag[]
  persons: ScrapedCharacterPersonFact[]
  photos: string[]
}

export type CharacterScraperSession = BaseScraperSession<
  CharacterScraperSlot,
  CharacterSessionResultMap
>

export interface CharacterScraperProvider {
  readonly id: string
  readonly name: string
  readonly externalIdSource: string
  readonly capabilities: readonly ScraperCapability[]

  /** Present if and only if `capabilities` declares `search`. */
  search?(query: string, ctx: ScraperProviderContext): Promise<CharacterSearchResult[]>
  resolve(
    lookup: ScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<CharacterResolvedTarget | null>
  openSession(
    target: CharacterResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<CharacterScraperSession>
}
