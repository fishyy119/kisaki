import type { ContentEntityType } from '@shared/common'
import type { Locale } from '@shared/locale'

export interface ScraperProfileProviderSlot {
  slot: string
  providerIds: string[]
}

export interface ScraperProfileSummary {
  id: string
  name: string
  description: string | null
  mediaType: ContentEntityType
  searchProviderId: string
  defaultLocale: Locale | null
  providerSlots: ScraperProfileProviderSlot[]
}

export interface ScraperProfileListQuery {
  mediaType?: ContentEntityType
}
