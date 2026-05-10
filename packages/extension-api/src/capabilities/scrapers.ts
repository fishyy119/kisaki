import type { Locale } from '../shared'
import type { ScraperMediaType } from '../contributions/scraper-providers'

export interface ScraperProfileProviderSlot {
  slot: string
  providerIds: readonly string[]
}

export interface ScraperProfileSummary {
  id: string
  name: string
  description: string | null
  mediaType: ScraperMediaType
  searchProviderId: string
  defaultLocale: Locale | null
  providerSlots: readonly ScraperProfileProviderSlot[]
}

export interface ScraperProfileListQuery {
  mediaType?: ScraperMediaType
}

export interface ScraperProfilesCapability {
  list(query?: ScraperProfileListQuery): Promise<readonly ScraperProfileSummary[]>
  get(profileId: string): Promise<ScraperProfileSummary | null>
}

export interface ScrapersCapability {
  profiles: ScraperProfilesCapability
}
