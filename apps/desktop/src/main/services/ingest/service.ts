/**
 * Ingest Service
 *
 * Orchestrates all metadata write flows through add/update handlers.
 */

import { createLogger } from '@main/log'
import type { IContentService, ServiceInitContainer, ServiceName } from '@main/container'
import type { ContentEntityType } from '@shared/common'
import { IngestPersistHandlers } from './persist'
import {
  AnimeAddHandler,
  CharacterAddHandler,
  ComicAddHandler,
  CompanyAddHandler,
  GameAddHandler,
  NovelAddHandler,
  PersonAddHandler
} from './add'
import {
  AnimeUpdateHandler,
  CharacterUpdateHandler,
  ComicUpdateHandler,
  CompanyUpdateHandler,
  GameUpdateHandler,
  NovelUpdateHandler,
  PersonUpdateHandler
} from './update'
import {
  AnimeBatchHandler,
  CharacterBatchHandler,
  ComicBatchHandler,
  CompanyBatchHandler,
  GameBatchHandler,
  NovelBatchHandler,
  PersonBatchHandler
} from './batch'
import { registerIngestIpc } from './ipc'
import { createIngestHooks } from './hooks'

const log = createLogger('Ingest')

/**
 * Compile-time coverage guard: handler maps are keyed by the full content
 * union, so adding a media type does not compile until its add, update, and
 * batch flows are decided here.
 */
type IngestHandlersByContent<THandlers extends Record<ContentEntityType, object>> = THandlers

type IngestAddHandlers = IngestHandlersByContent<{
  game: GameAddHandler
  anime: AnimeAddHandler
  comic: ComicAddHandler
  novel: NovelAddHandler
  person: PersonAddHandler
  company: CompanyAddHandler
  character: CharacterAddHandler
}>

type IngestUpdateHandlers = IngestHandlersByContent<{
  game: GameUpdateHandler
  anime: AnimeUpdateHandler
  comic: ComicUpdateHandler
  novel: NovelUpdateHandler
  person: PersonUpdateHandler
  company: CompanyUpdateHandler
  character: CharacterUpdateHandler
}>

type IngestBatchHandlers = IngestHandlersByContent<{
  game: GameBatchHandler
  anime: AnimeBatchHandler
  comic: ComicBatchHandler
  novel: NovelBatchHandler
  person: PersonBatchHandler
  company: CompanyBatchHandler
  character: CharacterBatchHandler
}>

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
      anime: new AnimeAddHandler(
        dbService,
        scraperService,
        persist.anime,
        taskRunService,
        i18nService,
        this.hooks.anime
      ),
      comic: new ComicAddHandler(
        dbService,
        scraperService,
        persist.comic,
        taskRunService,
        i18nService,
        this.hooks.comic
      ),
      novel: new NovelAddHandler(
        dbService,
        scraperService,
        persist.novel,
        taskRunService,
        i18nService,
        this.hooks.novel
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
      anime: new AnimeUpdateHandler(
        dbService,
        scraperService,
        persist,
        taskRunService,
        i18nService,
        this.hooks.anime
      ),
      comic: new ComicUpdateHandler(
        dbService,
        scraperService,
        persist,
        taskRunService,
        i18nService,
        this.hooks.comic
      ),
      novel: new NovelUpdateHandler(
        dbService,
        scraperService,
        persist,
        taskRunService,
        i18nService,
        this.hooks.novel
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
      anime: new AnimeBatchHandler(
        dbService,
        scraperService,
        this.update.anime,
        taskRunService,
        i18nService
      ),
      comic: new ComicBatchHandler(
        dbService,
        scraperService,
        this.update.comic,
        taskRunService,
        i18nService
      ),
      novel: new NovelBatchHandler(
        dbService,
        scraperService,
        this.update.novel,
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
    return ['game', 'anime', 'comic', 'novel', 'character', 'person', 'company']
  }
}
