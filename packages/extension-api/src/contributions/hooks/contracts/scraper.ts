import type { LibraryContentEntityType } from '../../../capabilities/library/entities'
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
import type { HookKind, HookPointSpec } from './point'

/**
 * The three scraper edges every content entity type reports. All waterfall:
 * `lookup` transforms the lookup before provider resolution, `searched`
 * transforms search results before they are returned, `collected` transforms
 * the merged bundle before it is returned to the caller.
 */
export const SCRAPER_HOOK_EDGE_KINDS = {
  lookup: 'waterfall',
  searched: 'waterfall',
  collected: 'waterfall'
} as const satisfies Record<string, HookKind>

export type ScraperHookEdge = keyof typeof SCRAPER_HOOK_EDGE_KINDS

/** Per-entity payloads; adding an entity type must add its row here. */
interface ScraperHookPayloads {
  game: { lookup: GameScraperLookup; searched: GameSearchResult[]; collected: ScrapedGameBundle }
  anime: {
    lookup: AnimeScraperLookup
    searched: AnimeSearchResult[]
    collected: ScrapedAnimeBundle
  }
  comic: {
    lookup: ComicScraperLookup
    searched: ComicSearchResult[]
    collected: ScrapedComicBundle
  }
  novel: {
    lookup: NovelScraperLookup
    searched: NovelSearchResult[]
    collected: ScrapedNovelBundle
  }
  person: { lookup: ScraperLookup; searched: PersonSearchResult[]; collected: ScrapedPersonBundle }
  company: {
    lookup: ScraperLookup
    searched: CompanySearchResult[]
    collected: ScrapedCompanyBundle
  }
  character: {
    lookup: ScraperLookup
    searched: CharacterSearchResult[]
    collected: ScrapedCharacterBundle
  }
}

type ScraperHookPointsFor<TEdge extends ScraperHookEdge> = {
  [TEntity in LibraryContentEntityType as `scraper.${TEntity}.${TEdge}`]: HookPointSpec<
    'waterfall',
    ScraperHookPayloads[TEntity][TEdge]
  >
}

export type ScraperHookPointId = keyof ScraperHookPointsFor<ScraperHookEdge>

/** Scraper hook points: one full edge set per content entity type. */
export type ScraperHookPoints = ScraperHookPointsFor<'lookup'> &
  ScraperHookPointsFor<'searched'> &
  ScraperHookPointsFor<'collected'>
