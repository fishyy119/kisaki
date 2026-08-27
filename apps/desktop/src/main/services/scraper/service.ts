/**
 * Scraper Service
 *
 * Lightweight service for scraper providers and profile-based metadata fetching.
 * Database CRUD is handled directly via Drizzle in both processes.
 *
 * Every provider is contributed by an extension: the service owns the per-media
 * registries, the profile catalogue, and the execution pipeline, while sources
 * live in extensions that reach it through the `scraperProviders` contribution
 * point. A profile therefore only scrapes what the enabled extensions offer.
 */

import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { EntityScraperHandler } from './handlers/handler'
import { SCRAPER_HANDLER_SPECS } from './handlers/specs'
import { registerScraperIpc } from './ipc'
import { createScraperHooks } from './hooks'
import { ScraperProfileCatalog } from './profiles'

const log = createLogger('Scraper')

export class ScraperService implements IService<'scraper'> {
  readonly id = 'scraper'
  readonly deps = ['db', 'i18n', 'ipc'] as const satisfies readonly ServiceName[]
  readonly hooks = createScraperHooks()

  profiles!: ScraperProfileCatalog
  game!: EntityScraperHandler<'game'>
  anime!: EntityScraperHandler<'anime'>
  comic!: EntityScraperHandler<'comic'>
  novel!: EntityScraperHandler<'novel'>
  person!: EntityScraperHandler<'person'>
  company!: EntityScraperHandler<'company'>
  character!: EntityScraperHandler<'character'>

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const db = container.get('db').client
    const i18n = container.get('i18n')
    const ipcService = container.get('ipc')

    this.profiles = new ScraperProfileCatalog(db)
    this.game = new EntityScraperHandler('game', SCRAPER_HANDLER_SPECS.game, db, i18n, this.hooks.game)
    this.anime = new EntityScraperHandler(
      'anime',
      SCRAPER_HANDLER_SPECS.anime,
      db,
      i18n,
      this.hooks.anime
    )
    this.comic = new EntityScraperHandler(
      'comic',
      SCRAPER_HANDLER_SPECS.comic,
      db,
      i18n,
      this.hooks.comic
    )
    this.novel = new EntityScraperHandler(
      'novel',
      SCRAPER_HANDLER_SPECS.novel,
      db,
      i18n,
      this.hooks.novel
    )
    this.person = new EntityScraperHandler(
      'person',
      SCRAPER_HANDLER_SPECS.person,
      db,
      i18n,
      this.hooks.person
    )
    this.company = new EntityScraperHandler(
      'company',
      SCRAPER_HANDLER_SPECS.company,
      db,
      i18n,
      this.hooks.company
    )
    this.character = new EntityScraperHandler(
      'character',
      SCRAPER_HANDLER_SPECS.character,
      db,
      i18n,
      this.hooks.character
    )
    registerScraperIpc(this, ipcService)

    log.info('Initialized')
  }
}
