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
import { createIngestHooks } from './hooks'

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
  readonly deps = [
    'db',
    'i18n',
    'ipc',
    'scraper',
    'task-run'
  ] as const satisfies readonly ServiceName[]
  readonly hooks = createIngestHooks()

  add!: IngestAddHandlers
  update!: IngestUpdateHandlers
  batch!: IngestBatchHandlers

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const ipcService = container.get('ipc')
    const scraperService = container.get('scraper')
    const taskRunService = container.get('task-run')
    const i18nService = container.get('i18n')
    const persist = new IngestPersistHandlers(dbService, i18nService)

    this.add = {
      game: new GameAddHandler(
        dbService,
        scraperService,
        persist.game,
        taskRunService,
        i18nService,
        this.hooks.game
      ),
      person: new PersonAddHandler(
        dbService,
        scraperService,
        persist.person,
        taskRunService,
        i18nService,
        this.hooks.person
      ),
      company: new CompanyAddHandler(
        dbService,
        scraperService,
        persist.company,
        taskRunService,
        i18nService,
        this.hooks.company
      ),
      character: new CharacterAddHandler(
        dbService,
        scraperService,
        persist.character,
        taskRunService,
        i18nService,
        this.hooks.character
      )
    }
    this.update = {
      game: new GameUpdateHandler(
        dbService,
        scraperService,
        persist,
        taskRunService,
        i18nService,
        this.hooks.game
      ),
      person: new PersonUpdateHandler(
        dbService,
        scraperService,
        taskRunService,
        i18nService,
        this.hooks.person
      ),
      company: new CompanyUpdateHandler(
        dbService,
        scraperService,
        taskRunService,
        i18nService,
        this.hooks.company
      ),
      character: new CharacterUpdateHandler(
        dbService,
        scraperService,
        persist,
        taskRunService,
        i18nService,
        this.hooks.character
      )
    }
    this.batch = {
      game: new GameBatchHandler(
        dbService,
        scraperService,
        this.update.game,
        taskRunService,
        i18nService
      ),
      person: new PersonBatchHandler(
        dbService,
        scraperService,
        this.update.person,
        taskRunService,
        i18nService
      ),
      company: new CompanyBatchHandler(
        dbService,
        scraperService,
        this.update.company,
        taskRunService,
        i18nService
      ),
      character: new CharacterBatchHandler(
        dbService,
        scraperService,
        this.update.character,
        taskRunService,
        i18nService
      )
    }

    registerIngestIpc(this, ipcService)
    log.info('Initialized')
  }

  getSupportedContent(): ContentEntityType[] {
    return ['game', 'character', 'person', 'company']
  }
}
