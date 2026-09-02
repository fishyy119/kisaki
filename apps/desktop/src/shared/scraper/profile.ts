import type { ContentEntityType } from '@shared/entity-types'
import type { ContentLocale } from '@shared/i18n'

export interface ScraperProfileProviderSlot {
  slot: string
  /** Provider ids are interpreted within the parent profile entityType. */
  providerIds: string[]
}

export interface ScraperProfileSummary {
  id: string
  name: string
  description: string | null
  entityType: ContentEntityType
  /** Provider id interpreted within this profile's entityType. */
  searchProviderId: string
  defaultLocale: ContentLocale | null
  providerSlots: ScraperProfileProviderSlot[]
}

export interface ScraperProfileListQuery {
  entityType?: ContentEntityType
}
