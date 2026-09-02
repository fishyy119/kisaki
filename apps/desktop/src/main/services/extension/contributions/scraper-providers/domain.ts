import type { ContentEntityType } from '@shared/entity-types'
import type {
  AnimeScraperProviderRegistrationInfo,
  CharacterScraperProviderRegistrationInfo,
  ComicScraperProviderRegistrationInfo,
  CompanyScraperProviderRegistrationInfo,
  GameScraperProviderRegistrationInfo,
  NovelScraperProviderRegistrationInfo,
  PersonScraperProviderRegistrationInfo
} from '@kisaki3/extension-api'
import type { ScraperService } from '@main/services/scraper'
import type { RuntimeContributionOwner } from '../types'

export type ScraperKind =
  'games' | 'animes' | 'comics' | 'novels' | 'persons' | 'companies' | 'characters'
export type ScraperRpcAction =
  'search' | 'resolve' | 'session.open' | 'session.get' | 'session.close'

export type ScraperProviderRegistration =
  | GameScraperProviderRegistrationInfo
  | AnimeScraperProviderRegistrationInfo
  | ComicScraperProviderRegistrationInfo
  | NovelScraperProviderRegistrationInfo
  | PersonScraperProviderRegistrationInfo
  | CompanyScraperProviderRegistrationInfo
  | CharacterScraperProviderRegistrationInfo

export interface ScraperRegistration {
  owner: RuntimeContributionOwner
  entityType: ContentEntityType
  provider: ScraperProviderRegistration
  registryProviderId: string
}

export interface ScraperDomain {
  kind: ScraperKind
  entityType: ContentEntityType
  registerWithScraper(scraper: ScraperService, provider: unknown): void
  unregisterFromScraper(scraper: ScraperService, registryProviderId: string): void | Promise<void>
}
