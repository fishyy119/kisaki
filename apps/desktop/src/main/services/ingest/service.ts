/**
 * Ingest Service
 *
 * Orchestrates ingest add flows through entity handlers.
 */

import log from 'electron-log/main'
import type { IContentService, ServiceInitContainer, ServiceName } from '@main/container'
import type { ContentEntityType } from '@shared/common'
import type { IpcService } from '@main/services/ipc'
import { IngestPersistHandlers } from './persist'
import {
  CharacterIngestHandler,
  CompanyIngestHandler,
  GameIngestHandler,
  PersonIngestHandler
} from './handlers'

export class IngestService implements IContentService {
  readonly id = 'ingest'
  readonly deps = ['db', 'ipc', 'scraper'] as const satisfies readonly ServiceName[]

  game!: GameIngestHandler
  person!: PersonIngestHandler
  company!: CompanyIngestHandler
  character!: CharacterIngestHandler

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const ipcService = container.get('ipc')
    const scraperService = container.get('scraper')
    const persist = new IngestPersistHandlers(dbService)

    this.game = new GameIngestHandler(dbService, scraperService, persist.game)
    this.person = new PersonIngestHandler(dbService, scraperService, persist.person)
    this.company = new CompanyIngestHandler(dbService, scraperService, persist.company)
    this.character = new CharacterIngestHandler(dbService, scraperService, persist.character)

    this.setupIpcHandlers(ipcService)
    log.info('[IngestService] Initialized')
  }

  private setupIpcHandlers(ipc: IpcService): void {
    ipc.handle('ingest:add-game-direct', async (_, seed, options) => {
      try {
        const data = await this.game.addDirect(seed, options)
        return { success: true as const, data }
      } catch (error) {
        log.error('[IngestService] ingest:add-game-direct failed:', error)
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('ingest:add-game-from-scraper', async (_, profileId, lookup, options) => {
      try {
        const data = await this.game.addFromScraper(profileId, lookup, options)
        return { success: true as const, data }
      } catch (error) {
        log.error('[IngestService] ingest:add-game-from-scraper failed:', error)
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('ingest:add-person-from-scraper', async (_, profileId, lookup, options) => {
      try {
        const data = await this.person.addFromScraper(profileId, lookup, options)
        return { success: true as const, data }
      } catch (error) {
        log.error('[IngestService] ingest:add-person-from-scraper failed:', error)
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('ingest:add-company-from-scraper', async (_, profileId, lookup, options) => {
      try {
        const data = await this.company.addFromScraper(profileId, lookup, options)
        return { success: true as const, data }
      } catch (error) {
        log.error('[IngestService] ingest:add-company-from-scraper failed:', error)
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('ingest:add-character-from-scraper', async (_, profileId, lookup, options) => {
      try {
        const data = await this.character.addFromScraper(profileId, lookup, options)
        return { success: true as const, data }
      } catch (error) {
        log.error('[IngestService] ingest:add-character-from-scraper failed:', error)
        return { success: false as const, error: (error as Error).message }
      }
    })
  }

  getSupportedContent(): ContentEntityType[] {
    return ['game', 'character', 'person', 'company']
  }
}
