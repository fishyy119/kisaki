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
  type AnimeImageSlot,
  type TvImageSlot,
  type MovieImageSlot,
  type SlotConfigForSlot,
  type SlotConfigsForMediaType,
  type RelationCollectionScraperSlot,
  GAME_IMAGE_SLOTS,
  ANIME_IMAGE_SLOTS,
  TV_IMAGE_SLOTS,
  MOVIE_IMAGE_SLOTS,
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
  normalizeSlotConfigs
} from './slot'

export type { ExternalId } from '@shared/identity'
export type {
  ScraperProfileListQuery,
  ScraperProfileProviderSlot,
  ScraperProfileSummary
} from './profile'
export {
  createExtensionScraperProviderId,
  parseExtensionScraperProviderId,
  type ExtensionScraperProviderIdParts
} from './provider-id'
export {
  type ScrapedEntityIdentity,
  type ScrapedIdentityCarrier,
  type ScraperSessionResult,
  type ScrapedGameInfo,
  type ScrapedAnimeInfo,
  type ScrapedTvInfo,
  type ScrapedMovieInfo,
  type ScrapedPersonInfo,
  type ScrapedCompanyInfo,
  type ScrapedCharacterInfo,
  type ScrapedGameCore,
  type ScrapedAnimeCore,
  type ScrapedTvCore,
  type ScrapedMovieCore,
  type ScrapedPersonCore,
  type ScrapedCompanyCore,
  type ScrapedCharacterCore,
  type ScrapedGameBundle,
  type ScrapedGameRelationFacts,
  type ScrapedAnimeBundle,
  type ScrapedAnimeRelationFacts,
  type ScrapedTvBundle,
  type ScrapedTvRelationFacts,
  type ScrapedMovieBundle,
  type ScrapedMovieRelationFacts,
  type ScrapedPersonBundle,
  type ScrapedCompanyBundle,
  type ScrapedCharacterBundle,
  type ScrapedCharacterRelationFacts,
  type ScrapedGamePersonFact,
  type ScrapedGameCharacterFact,
  type ScrapedGameCompanyFact,
  type ScrapedAnimePersonFact,
  type ScrapedAnimeCharacterFact,
  type ScrapedAnimeCompanyFact,
  type ScrapedTvPersonFact,
  type ScrapedTvCharacterFact,
  type ScrapedTvCompanyFact,
  type ScrapedMoviePersonFact,
  type ScrapedMovieCharacterFact,
  type ScrapedMovieCompanyFact,
  type ScrapedCharacterPersonFact,
  type ScrapedRelatedEntryFact,
  type ScrapedGameMetadata,
  type ScrapedAnimeMetadata,
  type ScrapedTvMetadata,
  type ScrapedMovieMetadata,
  type ScrapedPersonMetadata,
  type ScrapedCompanyMetadata,
  type ScrapedCharacterMetadata
} from './bundle'

// Media lookup facts shared by every media type
export { normalizeMediaLookupFacts, type MediaScraperLookup } from './media'

// Game-specific types
export { type GameScraperLookup, type GameScraperProviderInfo, type GameSearchResult } from './game'

// Anime-specific types
export {
  normalizeAnimeLookupFacts,
  selectAnimeSearchResult,
  type AnimeLookupFacts,
  type AnimeScraperLookup,
  type AnimeScraperProviderInfo,
  type AnimeSearchResult
} from './anime'

// TV-specific types
export {
  normalizeTvLookupFacts,
  selectTvSearchResult,
  type TvLookupFacts,
  type TvScraperLookup,
  type TvScraperProviderInfo,
  type TvSearchResult
} from './tv'

// Movie-specific types
export {
  normalizeMovieLookupFacts,
  selectMovieSearchResult,
  type MovieLookupFacts,
  type MovieScraperLookup,
  type MovieScraperProviderInfo,
  type MovieSearchResult
} from './movie'

// Metadata entity scraper types
export { type PersonScraperProviderInfo, type PersonSearchResult } from './person'
export { type CharacterScraperProviderInfo, type CharacterSearchResult } from './character'
export { type CompanyScraperProviderInfo, type CompanySearchResult } from './company'
