/**
 * Ingest Service
 *
 * Orchestrates all metadata write flows through add/update handlers.
 */

import log from 'electron-log/main'
import type { IContentService, ServiceInitContainer, ServiceName } from '@main/container'
import type { ContentEntityType } from '@shared/common'
import type { IpcService } from '@main/services/ipc'
import { IngestPersistHandlers } from './persist'
import { CharacterAddHandler, CompanyAddHandler, GameAddHandler, PersonAddHandler } from './add'
import {
  CharacterUpdateHandler,
  CompanyUpdateHandler,
  GameUpdateHandler,
  PersonUpdateHandler
} from './update'

interface IngestAddHandlers {
  game: GameAddHandler
  person: PersonAddHandler
  company: CompanyAddHandler
  character: CharacterAddHandler
}

interface IngestUpdateHandlers {
  game: GameUpdateHandler
  person: PersonUpdateHandler
  company: CompanyUpdateHandler
  character: CharacterUpdateHandler
}

export class IngestService implements IContentService {
  readonly id = 'ingest'
  readonly deps = ['db', 'ipc', 'scraper'] as const satisfies readonly ServiceName[]

  add!: IngestAddHandlers
  update!: IngestUpdateHandlers

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const ipcService = container.get('ipc')
    const scraperService = container.get('scraper')
    const persist = new IngestPersistHandlers(dbService)

    this.add = {
      game: new GameAddHandler(dbService, scraperService, persist.game),
      person: new PersonAddHandler(dbService, scraperService, persist.person),
      company: new CompanyAddHandler(dbService, scraperService, persist.company),
      character: new CharacterAddHandler(dbService, scraperService, persist.character)
    }
    this.update = {
      game: new GameUpdateHandler(dbService, scraperService, persist),
      person: new PersonUpdateHandler(dbService, scraperService),
      company: new CompanyUpdateHandler(dbService, scraperService),
      character: new CharacterUpdateHandler(dbService, scraperService, persist)
    }

    this.setupIpcHandlers(ipcService)
    log.info('[IngestService] Initialized')
  }

  private setupIpcHandlers(ipc: IpcService): void {
    ipc.handle('ingest:add-game-direct', async (_, seed, options) => {
      try {
        const data = await this.add.game.direct(seed, options)
        return { success: true as const, data }
      } catch (error) {
        log.error('[IngestService] ingest:add-game-direct failed:', error)
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('ingest:add-game-from-scraper', async (_, profileId, lookup, options) => {
      try {
        const data = await this.add.game.fromScraper(profileId, lookup, options)
        return { success: true as const, data }
      } catch (error) {
        log.error('[IngestService] ingest:add-game-from-scraper failed:', error)
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('ingest:add-person-from-scraper', async (_, profileId, lookup, options) => {
      try {
        const data = await this.add.person.fromScraper(profileId, lookup, options)
        return { success: true as const, data }
      } catch (error) {
        log.error('[IngestService] ingest:add-person-from-scraper failed:', error)
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('ingest:add-company-from-scraper', async (_, profileId, lookup, options) => {
      try {
        const data = await this.add.company.fromScraper(profileId, lookup, options)
        return { success: true as const, data }
      } catch (error) {
        log.error('[IngestService] ingest:add-company-from-scraper failed:', error)
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('ingest:add-character-from-scraper', async (_, profileId, lookup, options) => {
      try {
        const data = await this.add.character.fromScraper(profileId, lookup, options)
        return { success: true as const, data }
      } catch (error) {
        log.error('[IngestService] ingest:add-character-from-scraper failed:', error)
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('ingest:update-game-from-scraper', async (_, request) => {
      try {
        await this.update.game.fromScraper(request)
        return { success: true as const }
      } catch (error) {
        log.error('[IngestService] ingest:update-game-from-scraper failed:', error)
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('ingest:update-person-from-scraper', async (_, request) => {
      try {
        await this.update.person.fromScraper(request)
        return { success: true as const }
      } catch (error) {
        log.error('[IngestService] ingest:update-person-from-scraper failed:', error)
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('ingest:update-company-from-scraper', async (_, request) => {
      try {
        await this.update.company.fromScraper(request)
        return { success: true as const }
      } catch (error) {
        log.error('[IngestService] ingest:update-company-from-scraper failed:', error)
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('ingest:update-character-from-scraper', async (_, request) => {
      try {
        await this.update.character.fromScraper(request)
        return { success: true as const }
      } catch (error) {
        log.error('[IngestService] ingest:update-character-from-scraper failed:', error)
        return { success: false as const, error: (error as Error).message }
      }
    })
  }

  getSupportedContent(): ContentEntityType[] {
    return ['game', 'character', 'person', 'company']
  }
}
