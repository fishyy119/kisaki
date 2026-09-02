/**
 * Scraper module exports
 */

export { ScraperService } from './service'
export { ScraperProfileCatalog } from './profiles'
export { ScrapeFailure, type ScrapeFailureReason } from './shared'
export type { ScraperInvocationOptions, ScraperProviderContext } from './types'
export { EntityScrapeEngine } from './engine'
export type { ScrapeSearchResultOf } from './specs'
export type { GameScraperProvider } from './game'
export type { AnimeScraperProvider } from './anime'
export type { ComicScraperProvider } from './comic'
export type { NovelScraperProvider } from './novel'
export type { PersonScraperProvider } from './person'
export type { CompanyScraperProvider } from './company'
export type { CharacterScraperProvider } from './character'
