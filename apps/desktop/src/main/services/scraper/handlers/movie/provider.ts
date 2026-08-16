/**
 * Movie scraper provider runtime contract.
 */

import type { MovieScraperSlot } from '@shared/db'
import type { Tag } from '@shared/metadata'
import type {
  MovieScraperLookup,
  MovieSearchResult,
  ScrapedMovieCharacterFact,
  ScrapedMovieCompanyFact,
  ScrapedMovieInfo,
  ScrapedMoviePersonFact,
  ScrapedRelatedEntryFact,
  ScraperCapability
} from '@shared/scraper'
import {
  type BaseScraperSession,
  type IdResolvedTarget,
  type ScraperProviderContext
} from '../../types'

export type MovieResolvedTarget = IdResolvedTarget

export interface MovieSessionResultMap {
  info: ScrapedMovieInfo
  tags: Tag[]
  characters: ScrapedMovieCharacterFact[]
  persons: ScrapedMoviePersonFact[]
  companies: ScrapedMovieCompanyFact[]
  relatedEntries: ScrapedRelatedEntryFact[]
  covers: string[]
  backdrops: string[]
  logos: string[]
}

export type MovieScraperSession = BaseScraperSession<MovieScraperSlot, MovieSessionResultMap>

export interface MovieScraperProvider {
  readonly id: string
  readonly name: string
  readonly externalIdSource: string
  readonly capabilities: readonly ScraperCapability[]

  search(query: string, ctx: ScraperProviderContext): Promise<MovieSearchResult[]>
  resolve(
    lookup: MovieScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<MovieResolvedTarget | null>
  openSession(
    target: MovieResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<MovieScraperSession>
}
