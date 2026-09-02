/**
 * Novel scraper provider runtime contract.
 */

import type { NovelScraperSlot } from '@shared/db'
import type { NovelVolumeInfo, Tag } from '@shared/metadata'
import type {
  NovelScraperLookup,
  NovelSearchResult,
  ScrapedNovelInfo,
  ScrapedNovelCharacterFact,
  ScrapedNovelCompanyFact,
  ScrapedNovelPersonFact,
  ScrapedRelatedEntryFact,
  ScraperCapability
} from '@shared/scraper'
import {
  type BaseScraperSession,
  type IdResolvedTarget,
  type ScraperProviderContext
} from '../types'

export type NovelResolvedTarget = IdResolvedTarget

export interface NovelSessionResultMap {
  info: ScrapedNovelInfo
  tags: Tag[]
  volumes: NovelVolumeInfo[]
  characters: ScrapedNovelCharacterFact[]
  persons: ScrapedNovelPersonFact[]
  companies: ScrapedNovelCompanyFact[]
  relatedEntries: ScrapedRelatedEntryFact[]
  covers: string[]
  backdrops: string[]
  logos: string[]
}

export type NovelScraperSession = BaseScraperSession<NovelScraperSlot, NovelSessionResultMap>

export interface NovelScraperProvider {
  readonly id: string
  readonly name: string
  readonly externalIdSource: string
  readonly capabilities: readonly ScraperCapability[]

  /** Present if and only if `capabilities` declares `search`. */
  search?(query: string, ctx: ScraperProviderContext): Promise<NovelSearchResult[]>
  resolve(
    lookup: NovelScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<NovelResolvedTarget | null>
  openSession(
    target: NovelResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<NovelScraperSession>
}
