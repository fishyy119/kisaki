import type {
  CharacterScraperProviderRegistration,
  CompanyScraperProviderRegistration,
  GameScraperProviderRegistration,
  PersonScraperProviderRegistration
} from '@kisaki/extension-api'
import type { ScraperService } from '@main/services/scraper'
import type { ScraperMediaType } from '@shared/scraper'
import type { RuntimeContributionOwner } from '../types'

export type ScraperKind = 'games' | 'persons' | 'companies' | 'characters'
export type { ScraperMediaType } from '@shared/scraper'
export type ScraperRpcAction =
  | 'search'
  | 'resolve'
  | 'session.open'
  | 'session.get'
  | 'session.close'

export type ScraperProviderRegistration =
  | GameScraperProviderRegistration
  | PersonScraperProviderRegistration
  | CompanyScraperProviderRegistration
  | CharacterScraperProviderRegistration

export interface ScraperRegistration {
  owner: RuntimeContributionOwner
  mediaType: ScraperMediaType
  provider: ScraperProviderRegistration
  hostProviderId: string
}

export interface ScraperDomain {
  kind: ScraperKind
  mediaType: ScraperMediaType
  label: string
  registerWithScraper(scraper: ScraperService, provider: unknown): void
  unregisterFromScraper(scraper: ScraperService, hostProviderId: string): Promise<void>
  toSessionResults(results: unknown, registration: ScraperRegistration): unknown
}

export interface ExternalIdRecord {
  source: string
  id: string
}

export interface ValueWithExternalIds {
  externalIds: readonly ExternalIdRecord[]
}
