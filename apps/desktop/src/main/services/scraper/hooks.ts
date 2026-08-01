/**
 * Scraper module hook points.
 *
 * Owned by ScraperService and dispatched inside the media handlers. Subscribers
 * tap through `service.hooks.<mediaType>.*`; the module never knows who listens.
 */

import { createWaterfallHook, type WaterfallHook } from '@main/hooks'
import type {
  CharacterSearchResult,
  CompanySearchResult,
  GameSearchResult,
  PersonSearchResult,
  ScrapedCharacterBundle,
  ScrapedCompanyBundle,
  ScrapedGameBundle,
  ScrapedPersonBundle,
  ScraperLookup
} from '@shared/scraper'

export interface ScraperMediaHooks<TSearchResult, TBundle> {
  /** Transforms the lookup before provider resolution starts. */
  lookup: WaterfallHook<ScraperLookup>
  /** Transforms search results before they are returned to the caller. */
  searched: WaterfallHook<TSearchResult[]>
  /** Transforms the merged bundle before it is returned to the caller. */
  collected: WaterfallHook<TBundle>
}

export interface ScraperHooks {
  game: ScraperMediaHooks<GameSearchResult, ScrapedGameBundle>
  person: ScraperMediaHooks<PersonSearchResult, ScrapedPersonBundle>
  company: ScraperMediaHooks<CompanySearchResult, ScrapedCompanyBundle>
  character: ScraperMediaHooks<CharacterSearchResult, ScrapedCharacterBundle>
}

export function createScraperHooks(): ScraperHooks {
  return {
    game: createScraperMediaHooks('scraper.game'),
    person: createScraperMediaHooks('scraper.person'),
    company: createScraperMediaHooks('scraper.company'),
    character: createScraperMediaHooks('scraper.character')
  }
}

function createScraperMediaHooks<TSearchResult, TBundle>(
  prefix: string
): ScraperMediaHooks<TSearchResult, TBundle> {
  return {
    lookup: createWaterfallHook<ScraperLookup>(`${prefix}.lookup`),
    searched: createWaterfallHook<TSearchResult[]>(`${prefix}.searched`),
    collected: createWaterfallHook<TBundle>(`${prefix}.collected`)
  }
}
