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
import type { IContentService, ServiceInitContainer, ServiceName } from '@main/container'
import type { ContentEntityType } from '@shared/common'
import { GameScraperHandler } from './handlers/game'
import { AnimeScraperHandler } from './handlers/anime'
import { ComicScraperHandler } from './handlers/comic'
import { NovelScraperHandler } from './handlers/novel'
import { PersonScraperHandler } from './handlers/person'
import { CompanyScraperHandler } from './handlers/company'
import { CharacterScraperHandler } from './handlers/character'
import { registerScraperIpc } from './ipc'
import { createScraperHooks } from './hooks'
import { ScraperProfileCatalog } from './profiles'

const log = createLogger('Scraper')

export class ScraperService implements IContentService {
  readonly id = 'scraper'
  readonly deps = ['db', 'i18n', 'ipc'] as const satisfies readonly ServiceName[]
  readonly hooks = createScraperHooks()

  profiles!: ScraperProfileCatalog
  game!: GameScraperHandler
  anime!: AnimeScraperHandler
  comic!: ComicScraperHandler
  novel!: NovelScraperHandler
  person!: PersonScraperHandler
  company!: CompanyScraperHandler
  character!: CharacterScraperHandler

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const db = container.get('db').client
    const i18n = container.get('i18n')
    const ipcService = container.get('ipc')

    this.profiles = new ScraperProfileCatalog(db)
    this.game = new GameScraperHandler(db, i18n, this.hooks.game)
    this.anime = new AnimeScraperHandler(db, i18n, this.hooks.anime)
    this.comic = new ComicScraperHandler(db, i18n, this.hooks.comic)
    this.novel = new NovelScraperHandler(db, i18n, this.hooks.novel)
    this.person = new PersonScraperHandler(db, i18n, this.hooks.person)
    this.company = new CompanyScraperHandler(db, i18n, this.hooks.company)
    this.character = new CharacterScraperHandler(db, i18n, this.hooks.character)
    registerScraperIpc(this, ipcService)

    log.info('Initialized')
  }

  getSupportedContent(): ContentEntityType[] {
    return ['game', 'anime', 'comic', 'novel', 'character', 'person', 'company']
  }
}
