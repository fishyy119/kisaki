/**
 * Anime Scraper Types
 *
 * Type definitions for anime scraper providers, handlers, and operations.
 * This file contains only anime-specific types.
 */

import type { AnimeFormat, PartialDate } from '@shared/db'
import type { ExternalId } from '@shared/identity'
import type { ScraperCapability } from './slot'

// =============================================================================
// Provider Info
// =============================================================================

/** Information about a registered anime scraper provider */
export interface AnimeScraperProviderInfo {
  id: string
  name: string
  externalIdSource: string
  capabilities: ScraperCapability[]
}

// =============================================================================
// Search
// =============================================================================

/** A single anime search result */
export interface AnimeSearchResult {
  id: string
  name: string
  originalName?: string
  releaseDate?: PartialDate
  format?: AnimeFormat
  externalIds: ExternalId[]
}
