/**
 * Scraper module exports
 */

export { ScraperService } from './service'
export { ScraperProfileCatalog } from './profiles'
export { ScrapeFailure, type ScrapeFailureReason } from './shared'
export type { ScraperInvocationOptions, ScraperProviderContext } from './types'
export { EntityScraperHandler } from './handlers/handler'
export type { GameScraperProvider } from './handlers/game'
export type { AnimeScraperProvider } from './handlers/anime'
export type { ComicScraperProvider } from './handlers/comic'
export type { NovelScraperProvider } from './handlers/novel'
export type { PersonScraperProvider } from './handlers/person'
export type { CompanyScraperProvider } from './handlers/company'
export type { CharacterScraperProvider } from './handlers/character'
