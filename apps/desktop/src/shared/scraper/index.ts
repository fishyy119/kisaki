/**
 * Scraper types module
 *
 * Exports all scraper-related types and utilities.
 */

// Slot utilities and universal types
export {
  type ScraperCapability,
  type ScraperMediaType,
  type ScraperLookup,
  type ScraperImageSlot,
  type GameImageSlot,
  type SlotConfigForSlot,
  type SlotConfigsForMediaType,
  type RelationCollectionScraperSlot,
  GAME_IMAGE_SLOTS,
  SCRAPER_IMAGE_SLOTS,
  SLOT_STRATEGIES,
  UNMATCHED_ENTITY_POLICIES,
  isArraySlot,
  isImageSlot,
  isRelationCollectionSlot,
  isSimpleCollectionSlot,
  getSupportedSlotStrategies,
  getDefaultSlotStrategy,
  getDefaultUnmatchedEntityPolicy,
  normalizeSlotStrategy,
  createSlotConfig,
  createEmptySlotConfig,
  createSlotConfigs,
  getScraperSlotsForMediaType,
  normalizeSlotConfigs,
  type ProfileCleanupAction
} from './slot'

export type { ExternalId } from '@shared/identity'
export {
  type ScrapedGameBundle,
  type ScrapedPersonBundle,
  type ScrapedCompanyBundle,
  type ScrapedCharacterBundle,
  type ScrapedGamePersonFact,
  type ScrapedGameCharacterFact,
  type ScrapedGameCompanyFact,
  type ScrapedCharacterPersonFact,
  type ScrapedGameMetadata,
  type ScrapedPersonMetadata,
  type ScrapedCompanyMetadata,
  type ScrapedCharacterMetadata
} from './bundle'

// Game-specific types
export { type GameScraperProviderInfo, type GameSearchResult } from './game'

// Metadata entity scraper types
export { type PersonScraperProviderInfo, type PersonSearchResult } from './person'
export { type CharacterScraperProviderInfo, type CharacterSearchResult } from './character'
export { type CompanyScraperProviderInfo, type CompanySearchResult } from './company'
