import type { ContentLocale } from '../shared'
import type { ScraperEntityType } from '../contributions/scraper-providers'

export interface ScraperProfileProviderSlot {
  slot: string
  providerIds: readonly string[]
}

export interface ScraperProfileSummary {
  id: string
  name: string
  description: string | null
  entityType: ScraperEntityType
  searchProviderId: string
  defaultLocale: ContentLocale | null
  providerSlots: readonly ScraperProfileProviderSlot[]
}

export interface ScraperProfileListQuery {
  entityType?: ScraperEntityType | undefined
}

export interface ScraperProfilesCapability {
  list(query?: ScraperProfileListQuery): Promise<readonly ScraperProfileSummary[]>
  get(profileId: string): Promise<ScraperProfileSummary | null>
}

export interface ScrapersCapability {
  profiles: ScraperProfilesCapability
}
