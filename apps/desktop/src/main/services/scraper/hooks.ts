/**
 * Scraper module hook points.
 *
 * Owned by ScraperService and dispatched inside the media handlers. Subscribers
 * tap through `service.hooks.<mediaType>.*`; the module never knows who listens.
 */

import { createWaterfallHook, type WaterfallHook } from '@main/hooks'
import type {
  AnimeScraperLookup,
  AnimeSearchResult,
  CharacterSearchResult,
  ComicScraperLookup,
  ComicSearchResult,
  CompanySearchResult,
  GameScraperLookup,
  GameSearchResult,
  NovelScraperLookup,
  NovelSearchResult,
  PersonSearchResult,
  ScrapedAnimeBundle,
  ScrapedCharacterBundle,
  ScrapedComicBundle,
  ScrapedCompanyBundle,
  ScrapedGameBundle,
  ScrapedNovelBundle,
  ScrapedPersonBundle,
  ScraperLookup
} from '@shared/scraper'

export interface ScraperMediaHooks<TLookup extends ScraperLookup, TSearchResult, TBundle> {
  /** Transforms the lookup before provider resolution starts. */
  lookup: WaterfallHook<TLookup>
  /** Transforms search results before they are returned to the caller. */
  searched: WaterfallHook<TSearchResult[]>
  /** Transforms the merged bundle before it is returned to the caller. */
  collected: WaterfallHook<TBundle>
}

export interface ScraperHooks {
  game: ScraperMediaHooks<GameScraperLookup, GameSearchResult, ScrapedGameBundle>
  anime: ScraperMediaHooks<AnimeScraperLookup, AnimeSearchResult, ScrapedAnimeBundle>
  comic: ScraperMediaHooks<ComicScraperLookup, ComicSearchResult, ScrapedComicBundle>
  novel: ScraperMediaHooks<NovelScraperLookup, NovelSearchResult, ScrapedNovelBundle>
  person: ScraperMediaHooks<ScraperLookup, PersonSearchResult, ScrapedPersonBundle>
  company: ScraperMediaHooks<ScraperLookup, CompanySearchResult, ScrapedCompanyBundle>
  character: ScraperMediaHooks<ScraperLookup, CharacterSearchResult, ScrapedCharacterBundle>
}

export function createScraperHooks(): ScraperHooks {
  return {
    game: createScraperMediaHooks('scraper.game'),
    anime: createScraperMediaHooks('scraper.anime'),
    comic: createScraperMediaHooks('scraper.comic'),
    novel: createScraperMediaHooks('scraper.novel'),
    person: createScraperMediaHooks('scraper.person'),
    company: createScraperMediaHooks('scraper.company'),
    character: createScraperMediaHooks('scraper.character')
  }
}

function createScraperMediaHooks<TLookup extends ScraperLookup, TSearchResult, TBundle>(
  prefix: string
): ScraperMediaHooks<TLookup, TSearchResult, TBundle> {
  return {
    lookup: createWaterfallHook<TLookup>(`${prefix}.lookup`),
    searched: createWaterfallHook<TSearchResult[]>(`${prefix}.searched`),
    collected: createWaterfallHook<TBundle>(`${prefix}.collected`)
  }
}
