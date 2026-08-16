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
  CompanyAddHandler,
  GameAddHandler,
  MovieAddHandler,
  PersonAddHandler,
  TvAddHandler
} from './add'
import {
  AnimeUpdateHandler,
  CharacterUpdateHandler,
  CompanyUpdateHandler,
  GameUpdateHandler,
  MovieUpdateHandler,
  PersonUpdateHandler,
  TvUpdateHandler
} from './update'
import {
  AnimeBatchHandler,
  CharacterBatchHandler,
  CompanyBatchHandler,
  GameBatchHandler,
  MovieBatchHandler,
  PersonBatchHandler,
  TvBatchHandler
} from './batch'
import { AnimeFileSyncHandler, MovieFileSyncHandler, TvFileSyncHandler } from './files'
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
  tv: TvAddHandler
  movie: MovieAddHandler
  person: PersonAddHandler
  company: CompanyAddHandler
  character: CharacterAddHandler
}>

type IngestUpdateHandlers = IngestHandlersByContent<{
  game: GameUpdateHandler
  anime: AnimeUpdateHandler
  tv: TvUpdateHandler
  movie: MovieUpdateHandler
  person: PersonUpdateHandler
  company: CompanyUpdateHandler
  character: CharacterUpdateHandler
}>

type IngestBatchHandlers = IngestHandlersByContent<{
  game: GameBatchHandler
  anime: AnimeBatchHandler
  tv: TvBatchHandler
  movie: MovieBatchHandler
  person: PersonBatchHandler
  company: CompanyBatchHandler
  character: CharacterBatchHandler
}>

/** Handlers that reconcile an entity's local media files with its rows. */
interface IngestFileHandlers {
  anime: AnimeFileSyncHandler
  tv: TvFileSyncHandler
  movie: MovieFileSyncHandler
}

export class IngestService implements IContentService {
  readonly id = 'ingest'
  readonly deps = [
    'db',
    'i18n',
    'ipc',
    'media-info',
    'scraper',
    'task-run'
  ] as const satisfies readonly ServiceName[]
  readonly hooks = createIngestHooks()

  add!: IngestAddHandlers
  update!: IngestUpdateHandlers
  batch!: IngestBatchHandlers
  files!: IngestFileHandlers

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
      tv: new TvAddHandler(
        dbService,
        scraperService,
        persist.tv,
        taskRunService,
        i18nService,
        this.hooks.tv
      ),
      movie: new MovieAddHandler(
        dbService,
        scraperService,
        persist.movie,
        taskRunService,
        i18nService,
        this.hooks.movie
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
      tv: new TvUpdateHandler(
        dbService,
        scraperService,
        persist,
        taskRunService,
        i18nService,
        this.hooks.tv
      ),
      movie: new MovieUpdateHandler(
        dbService,
        scraperService,
        persist,
        taskRunService,
        i18nService,
        this.hooks.movie
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
      tv: new TvBatchHandler(
        dbService,
        scraperService,
        this.update.tv,
        taskRunService,
        i18nService
      ),
      movie: new MovieBatchHandler(
        dbService,
        scraperService,
        this.update.movie,
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

    const mediaInfoService = container.get('media-info')
    this.files = {
      anime: new AnimeFileSyncHandler(dbService, mediaInfoService),
      tv: new TvFileSyncHandler(dbService, mediaInfoService),
      movie: new MovieFileSyncHandler(dbService, mediaInfoService)
    }

    registerIngestIpc(this, ipcService)
    log.info('Initialized')
  }

  getSupportedContent(): ContentEntityType[] {
    return ['game', 'anime', 'tv', 'movie', 'character', 'person', 'company']
  }
}
