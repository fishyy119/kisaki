/**
 * Ingest Service
 *
 * Orchestrates all metadata write flows through add/update handlers.
 */

import { createLogger } from '@main/log'
import type { IContentService, ServiceInitContainer, ServiceName } from '@main/container'
import type { ContentEntityType } from '@shared/common'
import { IngestPersistHandlers } from './persist'
import { CharacterAddHandler, CompanyAddHandler, GameAddHandler, PersonAddHandler } from './add'
import {
  CharacterUpdateHandler,
  CompanyUpdateHandler,
  GameUpdateHandler,
  PersonUpdateHandler
} from './update'
import { registerIngestIpc } from './ipc'

const log = createLogger('Ingest')

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

    registerIngestIpc(this, ipcService)
    log.info('Initialized')
  }

  getSupportedContent(): ContentEntityType[] {
    return ['game', 'character', 'person', 'company']
  }
}
