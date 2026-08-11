import type {
  AnimeSearchResult,
  CharacterSearchResult,
  CompanySearchResult,
  GameSearchResult,
  PersonSearchResult,
  ScrapedAnimeBundle,
  ScrapedCharacterBundle,
  ScrapedCompanyBundle,
  ScrapedGameBundle,
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
  'scraper.game.lookup': HookPointSpec<'waterfall', ScraperLookup>
  'scraper.game.searched': HookPointSpec<'waterfall', GameSearchResult[]>
  'scraper.game.collected': HookPointSpec<'waterfall', ScrapedGameBundle>
  'scraper.anime.lookup': HookPointSpec<'waterfall', ScraperLookup>
  'scraper.anime.searched': HookPointSpec<'waterfall', AnimeSearchResult[]>
  'scraper.anime.collected': HookPointSpec<'waterfall', ScrapedAnimeBundle>
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
