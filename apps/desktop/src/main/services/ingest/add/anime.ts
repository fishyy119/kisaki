import type {
  IngestAddAnimeDirectOptions,
  IngestAddAnimeDirectResult,
  IngestAddAnimeDirectSeed,
  IngestAddAnimeFromScraperOptions,
  IngestAddAnimeFromScraperResult
} from '@shared/ingest/add'
import type { ScraperLookup } from '@shared/scraper'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import { isCancellation, type TaskRunHandle, type TaskRunService } from '@main/services/task-run'
import type { TaskRunStartResult } from '@shared/task-run'
import type { AnimeIngestPersistHandler } from '../persist'
import { requireIngestAllowed, type IngestEntityHooks } from '../hooks'
import { buildAnimeGraph, buildDirectAnimeGraph } from '../graph'
import {
  addAnimeToCollection,
  normalizeIngestLookupInput,
  normalizeLookup,
  requireScrapedBundle
} from './common'
import { reportIngestProgress } from '../progress'
import { throwIfIngestAborted } from '../abort'
import type { IngestOperationOptions, IngestTaskRunOptions } from '../types'
import { toTaskRunWarnings, waitForIngestRunOutput } from '../task-run'

type AnimeAddFromScraperOptions = IngestAddAnimeFromScraperOptions & IngestOperationOptions
type AnimeAddDirectOptions = IngestAddAnimeDirectOptions & IngestOperationOptions
type AnimeAddFromScraperTaskRunOptions = IngestAddAnimeFromScraperOptions & IngestTaskRunOptions
type AnimeAddDirectTaskRunOptions = IngestAddAnimeDirectOptions & IngestTaskRunOptions

export class AnimeAddHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandler: AnimeIngestPersistHandler,
    private readonly taskRunService: TaskRunService,
    private readonly i18nService: I18nService,
    private readonly hooks: IngestEntityHooks
  ) {}

  startAddFromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: AnimeAddFromScraperTaskRunOptions
  ): TaskRunStartResult {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    const run = this.createRun(normalized.lookup.name, options?.taskRunInitiator)

    void this.handleAddFromScraperWithTaskRun(run, normalized.profileId, normalized.lookup, options)
    return { runId: run.id, createdAt: run.createdAt }
  }

  startAddDirect(
    seed: IngestAddAnimeDirectSeed,
    options?: AnimeAddDirectTaskRunOptions
  ): TaskRunStartResult {
    const normalizedLookup = normalizeLookup({
      name: seed.name,
      knownIds: seed.knownIds
    })
    const run = this.createRun(normalizedLookup.name, options?.taskRunInitiator)

    void this.handleAddDirectWithTaskRun(run, normalizedLookup, options)
    return { runId: run.id, createdAt: run.createdAt }
  }

  async addFromScraperWithTaskRun(
    profileId: string,
    lookup: ScraperLookup,
    options?: AnimeAddFromScraperTaskRunOptions
  ): Promise<IngestAddAnimeFromScraperResult> {
    const start = this.startAddFromScraper(profileId, lookup, options)
    return waitForIngestRunOutput<IngestAddAnimeFromScraperResult>(this.taskRunService, start.runId)
  }

  async addFromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: AnimeAddFromScraperOptions
  ): Promise<IngestAddAnimeFromScraperResult> {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      label: this.i18nService.messages.ingest.add.checkingExisting({ entity: 'anime' })
    })
    const existing = this.tryResolveExistingAnime(normalized.lookup.knownIds, options)
    if (existing) {
      return existing
    }

    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'scraping',
      label: this.i18nService.messages.ingest.add.scrapingMetadata({ entity: 'anime' })
    })
    const bundle = requireScrapedBundle(
      await this.scraperService.anime.scrape(normalized.profileId, normalized.lookup, {
        signal: options?.signal
      }),
      'anime'
    )
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'building',
      label: this.i18nService.messages.ingest.add.buildingMetadata({ entity: 'anime' })
    })
    const graph = buildAnimeGraph(bundle, normalized.lookup)
    await requireIngestAllowed(this.hooks.committing, {
      name: normalized.lookup.name,
      externalIds: bundle.identity.externalIds
    })
    reportIngestProgress(options, {
      phase: 'writing',
      label: this.i18nService.messages.ingest.add.writing({ entity: 'anime' })
    })
    const result = await this.persistHandler.persistAnimeGraph(graph, options)
    this.hooks.committed.dispatch({
      entityId: result.animeId,
      isNew: result.isNew,
      warnings: result.warnings ?? []
    })
    return result
  }

  async addDirectWithTaskRun(
    seed: IngestAddAnimeDirectSeed,
    options?: AnimeAddDirectTaskRunOptions
  ): Promise<IngestAddAnimeDirectResult> {
    const start = this.startAddDirect(seed, options)
    return waitForIngestRunOutput<IngestAddAnimeDirectResult>(this.taskRunService, start.runId)
  }

  async addDirect(
    seed: IngestAddAnimeDirectSeed,
    options?: AnimeAddDirectOptions
  ): Promise<IngestAddAnimeDirectResult> {
    const normalizedLookup = normalizeLookup({
      name: seed.name,
      knownIds: seed.knownIds
    })
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      label: this.i18nService.messages.ingest.add.checkingExisting({ entity: 'anime' }),
      phaseCurrent: 1,
      phaseTotal: 2
    })
    const existing = this.tryResolveExistingAnime(normalizedLookup.knownIds, options)
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
      label: this.i18nService.messages.ingest.add.writing({ entity: 'anime' }),
      phaseCurrent: 2,
      phaseTotal: 2
    })
    const graph = buildDirectAnimeGraph(normalizedLookup)
    const result = await this.persistHandler.persistAnimeGraph(graph, options)
    this.hooks.committed.dispatch({
      entityId: result.animeId,
      isNew: result.isNew,
      warnings: result.warnings ?? []
    })
    return result
  }

  private createRun(
    label: string,
    initiator: IngestTaskRunOptions['taskRunInitiator']
  ): TaskRunHandle {
    const title = this.i18nService.messages.ingest.add.title({ entity: 'anime' })
    return this.taskRunService.runs.create({
      category: 'ingest',
      operation: 'ingest.anime.add',
      title,
      description: label,
      owner: { type: 'app' },
      initiator: initiator ?? { type: 'user' },
      subject: { type: 'anime', labelSnapshot: label },
      controls: { cancelable: true, pausable: false },
      presentation: {
        notify: {
          enabled: true,
          title,
          showProgress: true,
          showResult: true,
          closable: true
        }
      }
    })
  }

  private async handleAddFromScraperWithTaskRun(
    run: TaskRunHandle,
    profileId: string,
    lookup: ScraperLookup,
    options?: AnimeAddFromScraperTaskRunOptions
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
    lookup: ScraperLookup,
    options?: AnimeAddDirectTaskRunOptions
  ): Promise<void> {
    try {
      run.start()
      const { taskRunInitiator: _taskRunInitiator, ...operationOptions } = options ?? {}
      const result = await this.addDirect(
        { name: lookup.name, knownIds: lookup.knownIds },
        {
          ...operationOptions,
          signal: run.context.signal,
          onProgress: (update) => run.context.report(update)
        }
      )
      this.completeRun(run, result)
    } catch (error) {
      this.finishRunFromError(run, error)
    }
  }

  private completeRun(
    run: TaskRunHandle,
    result: IngestAddAnimeFromScraperResult | IngestAddAnimeDirectResult
  ): void {
    const warningItems = toTaskRunWarnings(result.warnings)
    run.complete({
      title: result.isNew
        ? this.i18nService.messages.ingest.add.addedTitle({ entity: 'anime' })
        : this.i18nService.messages.ingest.add.existsTitle({ entity: 'anime' }),
      summary: result.isNew
        ? this.i18nService.messages.ingest.add.addedSummary({ entity: 'anime' })
        : this.i18nService.messages.ingest.add.existsSummary({ entity: 'anime' }),
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
        summary: this.i18nService.messages.ingest.add.cancelledSummary({ entity: 'anime' })
      })
      return
    }

    run.fail(error)
  }

  private tryResolveExistingAnime(
    knownIds: ScraperLookup['knownIds'],
    options?: AnimeAddDirectOptions | AnimeAddFromScraperOptions
  ): IngestAddAnimeDirectResult | undefined {
    if (options?.animeDirPath) {
      const existingByPath = this.dbService.entityFinder.findExistingAnime({
        path: options.animeDirPath
      })
      if (existingByPath) {
        addAnimeToCollection(this.dbService, existingByPath.id, options.targetCollectionId)
        return {
          animeId: existingByPath.id,
          isNew: false,
          existingReason: 'path'
        }
      }
    }

    if (knownIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExistingAnime({
        externalIds: knownIds
      })
      if (existingByExternalId) {
        addAnimeToCollection(this.dbService, existingByExternalId.id, options?.targetCollectionId)
        return {
          animeId: existingByExternalId.id,
          isNew: false,
          existingReason: 'externalId'
        }
      }
    }

    return undefined
  }
}
