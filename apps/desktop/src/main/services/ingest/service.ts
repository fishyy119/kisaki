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
import {
  CharacterBatchHandler,
  CompanyBatchHandler,
  GameBatchHandler,
  PersonBatchHandler
} from './batch'
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

interface IngestBatchHandlers {
  game: GameBatchHandler
  person: PersonBatchHandler
  company: CompanyBatchHandler
  character: CharacterBatchHandler
}

export class IngestService implements IContentService {
  readonly id = 'ingest'
  readonly deps = ['db', 'ipc', 'scraper', 'task-run'] as const satisfies readonly ServiceName[]

  add!: IngestAddHandlers
  update!: IngestUpdateHandlers
  batch!: IngestBatchHandlers

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const ipcService = container.get('ipc')
    const scraperService = container.get('scraper')
    const taskRunService = container.get('task-run')
    const persist = new IngestPersistHandlers(dbService)

    this.add = {
      game: new GameAddHandler(dbService, scraperService, persist.game, taskRunService),
      person: new PersonAddHandler(dbService, scraperService, persist.person, taskRunService),
      company: new CompanyAddHandler(dbService, scraperService, persist.company, taskRunService),
      character: new CharacterAddHandler(
        dbService,
        scraperService,
        persist.character,
        taskRunService
      )
    }
    this.update = {
      game: new GameUpdateHandler(dbService, scraperService, persist, taskRunService),
      person: new PersonUpdateHandler(dbService, scraperService, taskRunService),
      company: new CompanyUpdateHandler(dbService, scraperService, taskRunService),
      character: new CharacterUpdateHandler(dbService, scraperService, persist, taskRunService)
    }
    this.batch = {
      game: new GameBatchHandler(dbService, scraperService, this.update.game, taskRunService),
      person: new PersonBatchHandler(dbService, scraperService, this.update.person, taskRunService),
      company: new CompanyBatchHandler(
        dbService,
        scraperService,
        this.update.company,
        taskRunService
      ),
      character: new CharacterBatchHandler(
        dbService,
        scraperService,
        this.update.character,
        taskRunService
      )
    }

    registerIngestIpc(this, ipcService)
    log.info('Initialized')
  }

  getSupportedContent(): ContentEntityType[] {
    return ['game', 'character', 'person', 'company']
  }
}
