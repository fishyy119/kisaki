/**
 * Ingest Service
 *
 * Orchestrates every metadata write flow: per-entity add and update engines
 * driven by specs, and the entity-generic batch update runner bound to those
 * engines and the scraper.
 */

import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { ContentEntityType } from '@shared/entity-types'
import { IngestPersisters } from './persist'
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
import { IngestBatchUpdateRunner, type IngestBatchDrivers } from './batch'
import { registerIngestIpc } from './ipc'
import { createIngestHooks } from './hooks'

const log = createLogger('Ingest')

/**
 * Compile-time coverage guard: engine maps are keyed by the full content
 * union, so adding a media type does not compile until its add and update
 * flows are decided here.
 */
type IngestEnginesByContent<TEngines extends Record<ContentEntityType, object>> = TEngines

type IngestAddEngines = IngestEnginesByContent<{
  game: MediaEntityAddApi<'game'>
  anime: MediaEntityAddApi<'anime'>
  comic: MediaEntityAddApi<'comic'>
  novel: MediaEntityAddApi<'novel'>
  person: EntityAddApi<'person'>
  company: EntityAddApi<'company'>
  character: EntityAddApi<'character'>
}>

type IngestUpdateEngines = IngestEnginesByContent<{
  game: EntityUpdateApi<'game'>
  anime: EntityUpdateApi<'anime'>
  comic: EntityUpdateApi<'comic'>
  novel: EntityUpdateApi<'novel'>
  person: EntityUpdateApi<'person'>
  company: EntityUpdateApi<'company'>
  character: EntityUpdateApi<'character'>
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

  add!: IngestAddEngines
  update!: IngestUpdateEngines
  batch!: IngestBatchUpdateRunner

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const ipcService = container.get('ipc')
    const scraperService = container.get('scraper')
    const taskRunService = container.get('task-run')
    const i18nService = container.get('i18n')
    const persist = new IngestPersisters(dbService, i18nService)

    // Registries are written out per entity on purpose: a literal key is the
    // only way the compiler correlates each engine with its spec and hooks, and
    // the Record type still fails the build when an entity is missing.
    const addDeps: EntityAddEngineDeps = {
      dbService,
      scraperService,
      persist,
      taskRunService,
      i18nService
    }
    const h = this.hooks
    this.add = {
      game: new EntityAddEngine('game', INGEST_ADD_SPECS.game, addDeps, h.game),
      anime: new EntityAddEngine('anime', INGEST_ADD_SPECS.anime, addDeps, h.anime),
      comic: new EntityAddEngine('comic', INGEST_ADD_SPECS.comic, addDeps, h.comic),
      novel: new EntityAddEngine('novel', INGEST_ADD_SPECS.novel, addDeps, h.novel),
      person: new EntityAddEngine('person', INGEST_ADD_SPECS.person, addDeps, h.person),
      company: new EntityAddEngine('company', INGEST_ADD_SPECS.company, addDeps, h.company),
      character: new EntityAddEngine('character', INGEST_ADD_SPECS.character, addDeps, h.character)
    }

    const updateDeps: EntityUpdateEngineDeps = {
      dbService,
      scraperService,
      persist,
      taskRunService,
      i18nService
    }
    const u = INGEST_UPDATE_SPECS
    this.update = {
      game: new EntityUpdateEngine('game', u.game, updateDeps, h.game),
      anime: new EntityUpdateEngine('anime', u.anime, updateDeps, h.anime),
      comic: new EntityUpdateEngine('comic', u.comic, updateDeps, h.comic),
      novel: new EntityUpdateEngine('novel', u.novel, updateDeps, h.novel),
      person: new EntityUpdateEngine('person', u.person, updateDeps, h.person),
      company: new EntityUpdateEngine('company', u.company, updateDeps, h.company),
      character: new EntityUpdateEngine('character', u.character, updateDeps, h.character)
    }

    // The batch runner is entity-generic; each driver binds one entity's
    // search and update so the runner never indexes services by a union key.
    const s = scraperService
    const up = this.update
    const drivers: IngestBatchDrivers = {
      game: {
        search: (profileId, query, signal) => s.game.search(profileId, query, { signal }),
        update: (request, signal) => up.game.updateFromScraper(request, { signal })
      },
      anime: {
        search: (profileId, query, signal) => s.anime.search(profileId, query, { signal }),
        update: (request, signal) => up.anime.updateFromScraper(request, { signal })
      },
      comic: {
        search: (profileId, query, signal) => s.comic.search(profileId, query, { signal }),
        update: (request, signal) => up.comic.updateFromScraper(request, { signal })
      },
      novel: {
        search: (profileId, query, signal) => s.novel.search(profileId, query, { signal }),
        update: (request, signal) => up.novel.updateFromScraper(request, { signal })
      },
      person: {
        search: (profileId, query, signal) => s.person.search(profileId, query, { signal }),
        update: (request, signal) => up.person.updateFromScraper(request, { signal })
      },
      company: {
        search: (profileId, query, signal) => s.company.search(profileId, query, { signal }),
        update: (request, signal) => up.company.updateFromScraper(request, { signal })
      },
      character: {
        search: (profileId, query, signal) => s.character.search(profileId, query, { signal }),
        update: (request, signal) => up.character.updateFromScraper(request, { signal })
      }
    }
    this.batch = new IngestBatchUpdateRunner({
      db: dbService.client,
      taskRun: taskRunService,
      i18n: i18nService,
      drivers
    })

    registerIngestIpc(this, ipcService)
    log.info('Initialized')
  }
}
