/**
 * TV scraper provider runtime contract.
 */

import type { TvScraperSlot } from '@shared/db'
import type { Tag, TvEpisodeInfo, TvSeasonInfo } from '@shared/metadata'
import type {
  ScrapedRelatedEntryFact,
  ScrapedTvCharacterFact,
  ScrapedTvCompanyFact,
  ScrapedTvInfo,
  ScrapedTvPersonFact,
  ScraperCapability,
  TvScraperLookup,
  TvSearchResult
} from '@shared/scraper'
import {
  type BaseScraperSession,
  type IdResolvedTarget,
  type ScraperProviderContext
} from '../../types'

export type TvResolvedTarget = IdResolvedTarget

export interface TvSessionResultMap {
  info: ScrapedTvInfo
  tags: Tag[]
  seasons: TvSeasonInfo[]
  episodes: TvEpisodeInfo[]
  characters: ScrapedTvCharacterFact[]
  persons: ScrapedTvPersonFact[]
  companies: ScrapedTvCompanyFact[]
  relatedEntries: ScrapedRelatedEntryFact[]
  covers: string[]
  backdrops: string[]
  logos: string[]
}

export type TvScraperSession = BaseScraperSession<TvScraperSlot, TvSessionResultMap>

export interface TvScraperProvider {
  readonly id: string
  readonly name: string
  readonly externalIdSource: string
  readonly capabilities: readonly ScraperCapability[]

  search(query: string, ctx: ScraperProviderContext): Promise<TvSearchResult[]>
  resolve(lookup: TvScraperLookup, ctx: ScraperProviderContext): Promise<TvResolvedTarget | null>
  openSession(target: TvResolvedTarget, ctx: ScraperProviderContext): Promise<TvScraperSession>
}
