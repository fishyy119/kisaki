import {
  ANIME_SCRAPER_SLOTS,
  CHARACTER_SCRAPER_SLOTS,
  COMIC_SCRAPER_SLOTS,
  COMPANY_SCRAPER_SLOTS,
  GAME_SCRAPER_SLOTS,
  NOVEL_SCRAPER_SLOTS,
  PERSON_SCRAPER_SLOTS,
  type HostToMainRpcMethod,
  type MainToHostRpcMethod,
  type ScraperMediaType
} from '@kisaki3/extension-api'

export interface MainToHostScraperProviderRpcDescriptor {
  search: Extract<MainToHostRpcMethod, 'contributions.scraperProviders.search'>
  resolve: Extract<MainToHostRpcMethod, 'contributions.scraperProviders.resolve'>
  open: Extract<MainToHostRpcMethod, 'contributions.scraperProviders.session.open'>
  get: Extract<MainToHostRpcMethod, 'contributions.scraperProviders.session.get'>
  close: Extract<MainToHostRpcMethod, 'contributions.scraperProviders.session.close'>
}

export interface HostToMainScraperProviderRpcDescriptor {
  register: Extract<HostToMainRpcMethod, 'contributions.scraperProviders.register'>
  unregister: Extract<HostToMainRpcMethod, 'contributions.scraperProviders.unregister'>
}

export const MAIN_TO_HOST_SCRAPER_RPC = {
  search: 'contributions.scraperProviders.search',
  resolve: 'contributions.scraperProviders.resolve',
  open: 'contributions.scraperProviders.session.open',
  get: 'contributions.scraperProviders.session.get',
  close: 'contributions.scraperProviders.session.close'
} as const satisfies MainToHostScraperProviderRpcDescriptor

export const HOST_TO_MAIN_SCRAPER_RPC = {
  register: 'contributions.scraperProviders.register',
  unregister: 'contributions.scraperProviders.unregister'
} as const satisfies HostToMainScraperProviderRpcDescriptor

export const SCRAPER_PROVIDER_SLOTS = {
  game: GAME_SCRAPER_SLOTS,
  anime: ANIME_SCRAPER_SLOTS,
  comic: COMIC_SCRAPER_SLOTS,
  novel: NOVEL_SCRAPER_SLOTS,
  person: PERSON_SCRAPER_SLOTS,
  company: COMPANY_SCRAPER_SLOTS,
  character: CHARACTER_SCRAPER_SLOTS
} as const satisfies Record<ScraperMediaType, readonly string[]>
