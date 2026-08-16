import type {
  IngestAddMovieDirectOptions,
  IngestAddMovieDirectResult,
  IngestAddMovieDirectSeed,
  IngestAddMovieFromScraperOptions,
  IngestAddMovieFromScraperResult
} from '@shared/ingest/add'
import type { MovieScraperLookup } from '@shared/scraper'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import { isCancellation, type TaskRunHandle, type TaskRunService } from '@main/services/task-run'
import type { TaskRunStartResult } from '@shared/task-run'
import type { MovieIngestPersistHandler } from '../persist'
import { requireIngestAllowed, type IngestEntityHooks } from '../hooks'
import { buildDirectMovieGraph, buildMovieGraph } from '../graph'
import {
  addMovieToCollection,
  normalizeIngestLookupInput,
  normalizeLookup,
  requireScrapedBundle
} from './common'
import { reportIngestProgress } from '../progress'
import { throwIfIngestAborted } from '../abort'
import type { IngestOperationOptions, IngestTaskRunOptions } from '../types'
import { createIngestRun, toTaskRunWarnings, waitForIngestRunOutput } from '../task-run'

type MovieAddFromScraperOptions = IngestAddMovieFromScraperOptions & IngestOperationOptions
type MovieAddDirectOptions = IngestAddMovieDirectOptions & IngestOperationOptions
type MovieAddFromScraperTaskRunOptions = IngestAddMovieFromScraperOptions & IngestTaskRunOptions
type MovieAddDirectTaskRunOptions = IngestAddMovieDirectOptions & IngestTaskRunOptions

export class MovieAddHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandler: MovieIngestPersistHandler,
    private readonly taskRunService: TaskRunService,
    private readonly i18nService: I18nService,
    private readonly hooks: IngestEntityHooks
  ) {}

  startAddFromScraper(
    profileId: string,
    lookup: MovieScraperLookup,
    options?: MovieAddFromScraperTaskRunOptions
  ): TaskRunStartResult {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    const run = this.createRun(normalized.lookup.name, options?.taskRunInitiator)

    void this.handleAddFromScraperWithTaskRun(run, normalized.profileId, normalized.lookup, options)
    return { runId: run.id, createdAt: run.createdAt }
  }

  startAddDirect(
    seed: IngestAddMovieDirectSeed,
    options?: MovieAddDirectTaskRunOptions
  ): TaskRunStartResult {
    const normalizedLookup = normalizeLookup({
      name: seed.name,
      knownIds: seed.knownIds
    })
    const run = this.createRun(normalizedLookup.name, options?.taskRunInitiator)

    void this.handleAddDirectWithTaskRun(
      run,
      { name: normalizedLookup.name, knownIds: normalizedLookup.knownIds },
      options
    )
    return { runId: run.id, createdAt: run.createdAt }
  }

  async addFromScraperWithTaskRun(
    profileId: string,
    lookup: MovieScraperLookup,
    options?: MovieAddFromScraperTaskRunOptions
  ): Promise<IngestAddMovieFromScraperResult> {
    const start = this.startAddFromScraper(profileId, lookup, options)
    return waitForIngestRunOutput<IngestAddMovieFromScraperResult>(this.taskRunService, start.runId)
  }

  async addFromScraper(
    profileId: string,
    lookup: MovieScraperLookup,
    options?: MovieAddFromScraperOptions
  ): Promise<IngestAddMovieFromScraperResult> {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      label: this.i18nService.messages.ingest.add.checkingExisting({ entity: 'movie' })
    })
    const existing = this.tryResolveExistingMovie(normalized.lookup.knownIds, options)
    if (existing) {
      return existing
    }

    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'scraping',
      label: this.i18nService.messages.ingest.add.scrapingMetadata({ entity: 'movie' })
    })
    const bundle = requireScrapedBundle(
      await this.scraperService.movie.scrape(normalized.profileId, normalized.lookup, {
        signal: options?.signal
      }),
      'movie'
    )
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'building',
      label: this.i18nService.messages.ingest.add.buildingMetadata({ entity: 'movie' })
    })
    const graph = buildMovieGraph(bundle, normalized.lookup)
    await requireIngestAllowed(this.hooks.committing, {
      name: normalized.lookup.name,
      externalIds: bundle.identity.externalIds
    })
    reportIngestProgress(options, {
      phase: 'writing',
      label: this.i18nService.messages.ingest.add.writing({ entity: 'movie' })
    })
    const result = await this.persistHandler.persistMovieGraph(graph, options)
    this.hooks.committed.dispatch({
      entityId: result.movieId,
      isNew: result.isNew,
      warnings: result.warnings ?? []
    })
    return result
  }

  async addDirectWithTaskRun(
    seed: IngestAddMovieDirectSeed,
    options?: MovieAddDirectTaskRunOptions
  ): Promise<IngestAddMovieDirectResult> {
    const start = this.startAddDirect(seed, options)
    return waitForIngestRunOutput<IngestAddMovieDirectResult>(this.taskRunService, start.runId)
  }

  async addDirect(
    seed: IngestAddMovieDirectSeed,
    options?: MovieAddDirectOptions
  ): Promise<IngestAddMovieDirectResult> {
    const normalizedLookup = normalizeLookup({
      name: seed.name,
      knownIds: seed.knownIds
    })
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      label: this.i18nService.messages.ingest.add.checkingExisting({ entity: 'movie' }),
      phaseCurrent: 1,
      phaseTotal: 2
    })
    const existing = this.tryResolveExistingMovie(normalizedLookup.knownIds, options)
    if (existing) {
      return existing
    }

    throwIfIngestAborted(options?.signal)
    await requireIngestAllowed(this.hooks.committing, {
      name: normalizedLookup.name,
      externalIds: normalizedLookup.knownIds ?? []
    })
    reportIngestProgress(options, {
      phase: 'writing',
      label: this.i18nService.messages.ingest.add.writing({ entity: 'movie' }),
      phaseCurrent: 2,
      phaseTotal: 2
    })
    const graph = buildDirectMovieGraph(normalizedLookup)
    const result = await this.persistHandler.persistMovieGraph(graph, options)
    this.hooks.committed.dispatch({
      entityId: result.movieId,
      isNew: result.isNew,
      warnings: result.warnings ?? []
    })
    return result
  }

  private createRun(
    label: string,
    initiator: IngestTaskRunOptions['taskRunInitiator']
  ): TaskRunHandle {
    return createIngestRun(this.taskRunService, {
      operation: 'ingest.movie.add',
      title: this.i18nService.messages.ingest.add.title({ entity: 'movie' }),
      label,
      subject: { type: 'movie' },
      initiator
    })
  }

  private async handleAddFromScraperWithTaskRun(
    run: TaskRunHandle,
    profileId: string,
    lookup: MovieScraperLookup,
    options?: MovieAddFromScraperTaskRunOptions
  ): Promise<void> {
    try {
      run.start()
      const { taskRunInitiator: _taskRunInitiator, ...operationOptions } = options ?? {}
      const result = await this.addFromScraper(profileId, lookup, {
        ...operationOptions,
        signal: run.context.signal,
        onProgress: (update) => run.context.report(update)
      })
      this.completeRun(run, result)
    } catch (error) {
      this.finishRunFromError(run, error)
    }
  }

  private async handleAddDirectWithTaskRun(
    run: TaskRunHandle,
    seed: IngestAddMovieDirectSeed,
    options?: MovieAddDirectTaskRunOptions
  ): Promise<void> {
    try {
      run.start()
      const { taskRunInitiator: _taskRunInitiator, ...operationOptions } = options ?? {}
      const result = await this.addDirect(seed, {
        ...operationOptions,
        signal: run.context.signal,
        onProgress: (update) => run.context.report(update)
      })
      this.completeRun(run, result)
    } catch (error) {
      this.finishRunFromError(run, error)
    }
  }

  private completeRun(
    run: TaskRunHandle,
    result: IngestAddMovieFromScraperResult | IngestAddMovieDirectResult
  ): void {
    const warningItems = toTaskRunWarnings(result.warnings)
    run.complete({
      title: result.isNew
        ? this.i18nService.messages.ingest.add.addedTitle({ entity: 'movie' })
        : this.i18nService.messages.ingest.add.existsTitle({ entity: 'movie' }),
      summary: result.isNew
        ? this.i18nService.messages.ingest.add.addedSummary({ entity: 'movie' })
        : this.i18nService.messages.ingest.add.existsSummary({ entity: 'movie' }),
      output: result,
      counters: {
        added: result.isNew ? 1 : 0,
        existing: result.isNew ? 0 : 1,
        warnings: result.warnings?.length ?? 0
      },
      warnings: warningItems
    })
  }

  private finishRunFromError(run: TaskRunHandle, error: unknown): void {
    if (isCancellation(error)) {
      run.cancel({
        summary: this.i18nService.messages.ingest.add.cancelledSummary({ entity: 'movie' })
      })
      return
    }

    run.fail(error)
  }

  private tryResolveExistingMovie(
    knownIds: MovieScraperLookup['knownIds'],
    options?: MovieAddDirectOptions | MovieAddFromScraperOptions
  ): IngestAddMovieDirectResult | undefined {
    if (options?.movieDirPath) {
      const existingByPath = this.dbService.entityFinder.findExistingMovie({
        path: options.movieDirPath
      })
      if (existingByPath) {
        addMovieToCollection(this.dbService, existingByPath.id, options.targetCollectionId)
        return {
          movieId: existingByPath.id,
          isNew: false,
          existingReason: 'path'
        }
      }
    }

    if (knownIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExistingMovie({
        externalIds: knownIds
      })
      if (existingByExternalId) {
        addMovieToCollection(this.dbService, existingByExternalId.id, options?.targetCollectionId)
        return {
          movieId: existingByExternalId.id,
          isNew: false,
          existingReason: 'externalId'
        }
      }
    }

    return undefined
  }
}
