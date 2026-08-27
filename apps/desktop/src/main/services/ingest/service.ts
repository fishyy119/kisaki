/**
 * Ingest Service
 *
 * Orchestrates all metadata write flows through add/update handlers.
 */

import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { ContentEntityType } from '@shared/common'
import { IngestPersistHandlers } from './persist'
import {
  EntityAddEngine,
  INGEST_ADD_SPECS,
  type EntityAddApi,
  type EntityAddEngineDeps,
  type MediaEntityAddApi
} from './add'
import {
  EntityUpdateEngine,
  INGEST_UPDATE_SPECS,
  type EntityUpdateApi,
  type EntityUpdateEngineDeps
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
  game: MediaEntityAddApi<'game'>
  anime: MediaEntityAddApi<'anime'>
  comic: MediaEntityAddApi<'comic'>
  novel: MediaEntityAddApi<'novel'>
  person: EntityAddApi<'person'>
  company: EntityAddApi<'company'>
  character: EntityAddApi<'character'>
}>

type IngestUpdateHandlers = IngestHandlersByContent<{
  game: EntityUpdateApi<'game'>
  anime: EntityUpdateApi<'anime'>
  comic: EntityUpdateApi<'comic'>
  novel: EntityUpdateApi<'novel'>
  person: EntityUpdateApi<'person'>
  company: EntityUpdateApi<'company'>
  character: EntityUpdateApi<'character'>
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

export class IngestService implements IService<'ingest'> {
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

    const addEngineDeps: EntityAddEngineDeps = {
      dbService,
      scraperService,
      persist,
      taskRunService,
      i18nService
    }
    this.add = {
      game: new EntityAddEngine('game', INGEST_ADD_SPECS.game, addEngineDeps, this.hooks.game),
      anime: new EntityAddEngine('anime', INGEST_ADD_SPECS.anime, addEngineDeps, this.hooks.anime),
      comic: new EntityAddEngine('comic', INGEST_ADD_SPECS.comic, addEngineDeps, this.hooks.comic),
      novel: new EntityAddEngine('novel', INGEST_ADD_SPECS.novel, addEngineDeps, this.hooks.novel),
      person: new EntityAddEngine(
        'person',
        INGEST_ADD_SPECS.person,
        addEngineDeps,
        this.hooks.person
      ),
      company: new EntityAddEngine(
        'company',
        INGEST_ADD_SPECS.company,
        addEngineDeps,
        this.hooks.company
      ),
      character: new EntityAddEngine(
        'character',
        INGEST_ADD_SPECS.character,
        addEngineDeps,
        this.hooks.character
      )
    }
    const updateEngineDeps: EntityUpdateEngineDeps = {
      dbService,
      scraperService,
      persist,
      taskRunService,
      i18nService
    }
    this.update = {
      game: new EntityUpdateEngine(
        'game',
        INGEST_UPDATE_SPECS.game,
        updateEngineDeps,
        this.hooks.game
      ),
      anime: new EntityUpdateEngine(
        'anime',
        INGEST_UPDATE_SPECS.anime,
        updateEngineDeps,
        this.hooks.anime
      ),
      comic: new EntityUpdateEngine(
        'comic',
        INGEST_UPDATE_SPECS.comic,
        updateEngineDeps,
        this.hooks.comic
      ),
      novel: new EntityUpdateEngine(
        'novel',
        INGEST_UPDATE_SPECS.novel,
        updateEngineDeps,
        this.hooks.novel
      ),
      person: new EntityUpdateEngine(
        'person',
        INGEST_UPDATE_SPECS.person,
        updateEngineDeps,
        this.hooks.person
      ),
      company: new EntityUpdateEngine(
        'company',
        INGEST_UPDATE_SPECS.company,
        updateEngineDeps,
        this.hooks.company
      ),
      character: new EntityUpdateEngine(
        'character',
        INGEST_UPDATE_SPECS.character,
        updateEngineDeps,
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
}
