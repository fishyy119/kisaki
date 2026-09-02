/**
 * Anime scraper provider runtime contract.
 */

import type { AnimeScraperSlot } from '@shared/db'
import type { AnimeEpisodeInfo, Tag } from '@shared/metadata'
import type {
  AnimeScraperLookup,
  AnimeSearchResult,
  ScrapedAnimeInfo,
  ScrapedAnimeCharacterFact,
  ScrapedAnimeCompanyFact,
  ScrapedAnimePersonFact,
  ScrapedRelatedEntryFact,
  ScraperCapability
} from '@shared/scraper'
import {
  type BaseScraperSession,
  type IdResolvedTarget,
  type ScraperProviderContext
} from '../types'

export type AnimeResolvedTarget = IdResolvedTarget

export interface AnimeSessionResultMap {
  info: ScrapedAnimeInfo
  tags: Tag[]
  episodes: AnimeEpisodeInfo[]
  characters: ScrapedAnimeCharacterFact[]
  persons: ScrapedAnimePersonFact[]
  companies: ScrapedAnimeCompanyFact[]
  relatedEntries: ScrapedRelatedEntryFact[]
  covers: string[]
  backdrops: string[]
  logos: string[]
}

export type AnimeScraperSession = BaseScraperSession<AnimeScraperSlot, AnimeSessionResultMap>

export interface AnimeScraperProvider {
  readonly id: string
  readonly name: string
  readonly externalIdSource: string
  readonly capabilities: readonly ScraperCapability[]

  /** Present if and only if `capabilities` declares `search`. */
  search?(query: string, ctx: ScraperProviderContext): Promise<AnimeSearchResult[]>
  resolve(
    lookup: AnimeScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<AnimeResolvedTarget | null>
  openSession(
    target: AnimeResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<AnimeScraperSession>
}
