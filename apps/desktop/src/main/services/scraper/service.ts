/**
 * Scraper Service
 *
 * Lightweight service for scraper providers and profile-based metadata fetching.
 * Database CRUD is handled directly via Drizzle in both processes.
 *
 * Responsibilities:
 * - Provider registration (builtin + extensions)
 * - Profile-based scraping operations via IPC
 */

import { createLogger } from '@main/log'
import type { IContentService, ServiceInitContainer, ServiceName } from '@main/container'
import type { ContentEntityType } from '@shared/common'
import { createScraperProviderDeps } from './deps'
import type { ScraperProviderDeps } from './types'
import { GameScraperHandler } from './handlers/game'
import { AnimeScraperHandler } from './handlers/anime'
import { PersonScraperHandler } from './handlers/person'
import { CompanyScraperHandler } from './handlers/company'
import { CharacterScraperHandler } from './handlers/character'
import { IGDBProvider } from './handlers/game/providers/igdb'
import { VNDBProvider } from './handlers/game/providers/vndb'
import { YmgalProvider } from './handlers/game/providers/ymgal'
import { registerScraperIpc } from './ipc'
import { createScraperHooks } from './hooks'
import { ScraperProfileCatalog } from './profiles'

const log = createLogger('Scraper')

export class ScraperService implements IContentService {
  readonly id = 'scraper'
  readonly deps = ['db', 'i18n', 'ipc', 'network'] as const satisfies readonly ServiceName[]
  readonly hooks = createScraperHooks()

  profiles!: ScraperProfileCatalog
  game!: GameScraperHandler
  anime!: AnimeScraperHandler
  person!: PersonScraperHandler
  company!: CompanyScraperHandler
  character!: CharacterScraperHandler

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const db = dbService.client
    const i18n = container.get('i18n')
    const ipcService = container.get('ipc')
    const providerDeps = createScraperProviderDeps({
      network: container.get('network'),
      log
    })

    this.profiles = new ScraperProfileCatalog(db)
    this.game = new GameScraperHandler(db, i18n, this.hooks.game)
    this.anime = new AnimeScraperHandler(db, i18n, this.hooks.anime)
    this.person = new PersonScraperHandler(db, i18n, this.hooks.person)
    this.company = new CompanyScraperHandler(db, i18n, this.hooks.company)
    this.character = new CharacterScraperHandler(db, i18n, this.hooks.character)
    this.registerBuiltinProviders(providerDeps)
    registerScraperIpc(this, ipcService)

    log.info('Initialized')
  }

  private registerBuiltinProviders(deps: ScraperProviderDeps): void {
    this.game.registerProvider(new YmgalProvider(deps))
    this.game.registerProvider(new IGDBProvider(deps))
    this.game.registerProvider(new VNDBProvider(deps))
  }

  getSupportedContent(): ContentEntityType[] {
    return ['game', 'anime', 'character', 'person', 'company']
  }
}
