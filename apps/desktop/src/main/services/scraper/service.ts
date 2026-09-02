/**
 * Scraper Service
 *
 * Fetches metadata from providers through profile-driven execution plans. One
 * generic scrape engine serves every content entity, parameterized by the
 * per-entity spec; the service exposes one engine per entity as
 * `scraper.<entity>`.
 *
 * Every provider is contributed by an extension: the service owns the
 * per-entity registries, the profile catalogue, and the execution pipeline,
 * while sources live in extensions that reach it through the
 * `scraperProviders` contribution point. A profile therefore only scrapes what
 * the enabled extensions offer.
 */

import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { EntityScrapeEngine } from './engine'
import { createScraperHooks } from './hooks'
import { registerScraperIpc } from './ipc'
import { ScraperProfileCatalog } from './profiles'
import { SCRAPER_SPECS } from './specs'

const log = createLogger('Scraper')

export class ScraperService implements IService<'scraper'> {
  readonly id = 'scraper'
  readonly deps = ['db', 'i18n', 'ipc'] as const satisfies readonly ServiceName[]
  readonly hooks = createScraperHooks()

  profiles!: ScraperProfileCatalog
  game!: EntityScrapeEngine<'game'>
  anime!: EntityScrapeEngine<'anime'>
  comic!: EntityScrapeEngine<'comic'>
  novel!: EntityScrapeEngine<'novel'>
  person!: EntityScrapeEngine<'person'>
  company!: EntityScrapeEngine<'company'>
  character!: EntityScrapeEngine<'character'>

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const db = container.get('db').client
    const i18n = container.get('i18n')

    // Written out per entity on purpose: a literal key is the only way the
    // compiler correlates each engine with its spec and hooks.
    const s = SCRAPER_SPECS
    const h = this.hooks
    this.profiles = new ScraperProfileCatalog(db)
    this.game = new EntityScrapeEngine('game', s.game, db, i18n, h.game)
    this.anime = new EntityScrapeEngine('anime', s.anime, db, i18n, h.anime)
    this.comic = new EntityScrapeEngine('comic', s.comic, db, i18n, h.comic)
    this.novel = new EntityScrapeEngine('novel', s.novel, db, i18n, h.novel)
    this.person = new EntityScrapeEngine('person', s.person, db, i18n, h.person)
    this.company = new EntityScrapeEngine('company', s.company, db, i18n, h.company)
    this.character = new EntityScrapeEngine('character', s.character, db, i18n, h.character)
    registerScraperIpc(this, container.get('ipc'))

    log.info('Initialized')
  }
}
