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
} from '../../scraper-providers'
import type { HookPointSpec } from './point'

/**
 * Scraper hook points.
 *
 * All waterfall: `lookup` transforms the lookup before provider resolution,
 * `searched` transforms search results before they are returned, `collected`
 * transforms the merged bundle before it is returned to the caller.
 */
export interface ScraperHookPoints {
  'scraper.game.lookup': HookPointSpec<'waterfall', GameScraperLookup>
  'scraper.game.searched': HookPointSpec<'waterfall', GameSearchResult[]>
  'scraper.game.collected': HookPointSpec<'waterfall', ScrapedGameBundle>
  'scraper.anime.lookup': HookPointSpec<'waterfall', AnimeScraperLookup>
  'scraper.anime.searched': HookPointSpec<'waterfall', AnimeSearchResult[]>
  'scraper.anime.collected': HookPointSpec<'waterfall', ScrapedAnimeBundle>
  'scraper.comic.lookup': HookPointSpec<'waterfall', ComicScraperLookup>
  'scraper.comic.searched': HookPointSpec<'waterfall', ComicSearchResult[]>
  'scraper.comic.collected': HookPointSpec<'waterfall', ScrapedComicBundle>
  'scraper.novel.lookup': HookPointSpec<'waterfall', NovelScraperLookup>
  'scraper.novel.searched': HookPointSpec<'waterfall', NovelSearchResult[]>
  'scraper.novel.collected': HookPointSpec<'waterfall', ScrapedNovelBundle>
  'scraper.person.lookup': HookPointSpec<'waterfall', ScraperLookup>
  'scraper.person.searched': HookPointSpec<'waterfall', PersonSearchResult[]>
  'scraper.person.collected': HookPointSpec<'waterfall', ScrapedPersonBundle>
  'scraper.company.lookup': HookPointSpec<'waterfall', ScraperLookup>
  'scraper.company.searched': HookPointSpec<'waterfall', CompanySearchResult[]>
  'scraper.company.collected': HookPointSpec<'waterfall', ScrapedCompanyBundle>
  'scraper.character.lookup': HookPointSpec<'waterfall', ScraperLookup>
  'scraper.character.searched': HookPointSpec<'waterfall', CharacterSearchResult[]>
  'scraper.character.collected': HookPointSpec<'waterfall', ScrapedCharacterBundle>
}
