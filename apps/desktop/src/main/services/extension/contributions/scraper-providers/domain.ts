import type {
  CharacterScraperProviderRegistrationInfo,
  CompanyScraperProviderRegistrationInfo,
  GameScraperProviderRegistrationInfo,
  PersonScraperProviderRegistrationInfo
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
  | GameScraperProviderRegistrationInfo
  | PersonScraperProviderRegistrationInfo
  | CompanyScraperProviderRegistrationInfo
  | CharacterScraperProviderRegistrationInfo

export interface ScraperRegistration {
  owner: RuntimeContributionOwner
  mediaType: ScraperMediaType
  provider: ScraperProviderRegistration
  hostProviderId: string
}

export interface ScraperDomain {
  kind: ScraperKind
  mediaType: ScraperMediaType
  registerWithScraper(scraper: ScraperService, provider: unknown): void
  unregisterFromScraper(scraper: ScraperService, hostProviderId: string): Promise<void>
}
