/**
 * Scraper module exports
 */

export { ScraperService } from './service'
export { ScraperProfileCatalog } from './profiles'
export { ScrapeFailure, type ScrapeFailureReason } from './shared'
export type { ScraperInvocationOptions, ScraperProviderContext } from './types'
export { GameScraperHandler, type GameScraperProvider } from './handlers/game'
export { AnimeScraperHandler, type AnimeScraperProvider } from './handlers/anime'
export { PersonScraperHandler, type PersonScraperProvider } from './handlers/person'
export { CompanyScraperHandler, type CompanyScraperProvider } from './handlers/company'
export { CharacterScraperHandler, type CharacterScraperProvider } from './handlers/character'
