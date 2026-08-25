/**
 * Comic scraper provider runtime contract.
 */

import type { ComicScraperSlot } from '@shared/db'
import type { ComicChapterInfo, Tag } from '@shared/metadata'
import type {
  ComicScraperLookup,
  ComicSearchResult,
  ScrapedComicInfo,
  ScrapedComicCharacterFact,
  ScrapedComicCompanyFact,
  ScrapedComicPersonFact,
  ScrapedRelatedEntryFact,
  ScraperCapability
} from '@shared/scraper'
import {
  type BaseScraperSession,
  type IdResolvedTarget,
  type ScraperProviderContext
} from '../../types'

export type ComicResolvedTarget = IdResolvedTarget

export interface ComicSessionResultMap {
  info: ScrapedComicInfo
  tags: Tag[]
  chapters: ComicChapterInfo[]
  characters: ScrapedComicCharacterFact[]
  persons: ScrapedComicPersonFact[]
  companies: ScrapedComicCompanyFact[]
  relatedEntries: ScrapedRelatedEntryFact[]
  covers: string[]
  backdrops: string[]
  logos: string[]
}

export type ComicScraperSession = BaseScraperSession<ComicScraperSlot, ComicSessionResultMap>

export interface ComicScraperProvider {
  readonly id: string
  readonly name: string
  readonly externalIdSource: string
  readonly capabilities: readonly ScraperCapability[]

  /** Present if and only if `capabilities` declares `search`. */
  search?(query: string, ctx: ScraperProviderContext): Promise<ComicSearchResult[]>
  resolve(
    lookup: ComicScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<ComicResolvedTarget | null>
  openSession(
    target: ComicResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<ComicScraperSession>
}
