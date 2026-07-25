import type { ContentEntityType } from '@shared/common'
import type { ContentLocale } from '@shared/i18n'

export interface ScraperProfileProviderSlot {
  slot: string
  /** Provider ids are interpreted within the parent profile mediaType. */
  providerIds: string[]
}

export interface ScraperProfileSummary {
  id: string
  name: string
  description: string | null
  mediaType: ContentEntityType
  /** Provider id interpreted within this profile's mediaType. */
  searchProviderId: string
  defaultLocale: ContentLocale | null
  providerSlots: ScraperProfileProviderSlot[]
}

export interface ScraperProfileListQuery {
  mediaType?: ContentEntityType
}
