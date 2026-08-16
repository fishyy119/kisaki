import type {
  IngestAddTvDirectOptions,
  IngestAddTvDirectResult,
  IngestAddTvDirectSeed,
  IngestAddTvFromScraperOptions,
  IngestAddTvFromScraperResult
} from '@shared/ingest/add'
import type { TvScraperLookup } from '@shared/scraper'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import { isCancellation, type TaskRunHandle, type TaskRunService } from '@main/services/task-run'
import type { TaskRunStartResult } from '@shared/task-run'
import type { TvIngestPersistHandler } from '../persist'
import { requireIngestAllowed, type IngestEntityHooks } from '../hooks'
import { buildDirectTvGraph, buildTvGraph } from '../graph'
import {
  addTvToCollection,
  normalizeIngestLookupInput,
  normalizeLookup,
  requireScrapedBundle
} from './common'
import { reportIngestProgress } from '../progress'
import { throwIfIngestAborted } from '../abort'
import type { IngestOperationOptions, IngestTaskRunOptions } from '../types'
import { createIngestRun, toTaskRunWarnings, waitForIngestRunOutput } from '../task-run'

type TvAddFromScraperOptions = IngestAddTvFromScraperOptions & IngestOperationOptions
type TvAddDirectOptions = IngestAddTvDirectOptions & IngestOperationOptions
type TvAddFromScraperTaskRunOptions = IngestAddTvFromScraperOptions & IngestTaskRunOptions
type TvAddDirectTaskRunOptions = IngestAddTvDirectOptions & IngestTaskRunOptions

export class TvAddHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandler: TvIngestPersistHandler,
    private readonly taskRunService: TaskRunService,
    private readonly i18nService: I18nService,
    private readonly hooks: IngestEntityHooks
  ) {}

  startAddFromScraper(
    profileId: string,
    lookup: TvScraperLookup,
    options?: TvAddFromScraperTaskRunOptions
  ): TaskRunStartResult {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    const run = this.createRun(normalized.lookup.name, options?.taskRunInitiator)

    void this.handleAddFromScraperWithTaskRun(run, normalized.profileId, normalized.lookup, options)
    return { runId: run.id, createdAt: run.createdAt }
  }

  startAddDirect(
    seed: IngestAddTvDirectSeed,
    options?: TvAddDirectTaskRunOptions
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
    lookup: TvScraperLookup,
    options?: TvAddFromScraperTaskRunOptions
  ): Promise<IngestAddTvFromScraperResult> {
    const start = this.startAddFromScraper(profileId, lookup, options)
    return waitForIngestRunOutput<IngestAddTvFromScraperResult>(this.taskRunService, start.runId)
  }

  async addFromScraper(
    profileId: string,
    lookup: TvScraperLookup,
    options?: TvAddFromScraperOptions
  ): Promise<IngestAddTvFromScraperResult> {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      label: this.i18nService.messages.ingest.add.checkingExisting({ entity: 'tv' })
    })
    const existing = this.tryResolveExistingTv(normalized.lookup.knownIds, options)
    if (existing) {
      return existing
    }

    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'scraping',
      label: this.i18nService.messages.ingest.add.scrapingMetadata({ entity: 'tv' })
    })
    const bundle = requireScrapedBundle(
      await this.scraperService.tv.scrape(normalized.profileId, normalized.lookup, {
        signal: options?.signal
      }),
      'tv'
    )
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'building',
      label: this.i18nService.messages.ingest.add.buildingMetadata({ entity: 'tv' })
    })
    const graph = buildTvGraph(bundle, normalized.lookup)
    await requireIngestAllowed(this.hooks.committing, {
      name: normalized.lookup.name,
      externalIds: bundle.identity.externalIds
    })
    reportIngestProgress(options, {
      phase: 'writing',
      label: this.i18nService.messages.ingest.add.writing({ entity: 'tv' })
    })
    const result = await this.persistHandler.persistTvGraph(graph, options)
    this.hooks.committed.dispatch({
      entityId: result.tvId,
      isNew: result.isNew,
      warnings: result.warnings ?? []
    })
    return result
  }

  async addDirectWithTaskRun(
    seed: IngestAddTvDirectSeed,
    options?: TvAddDirectTaskRunOptions
  ): Promise<IngestAddTvDirectResult> {
    const start = this.startAddDirect(seed, options)
    return waitForIngestRunOutput<IngestAddTvDirectResult>(this.taskRunService, start.runId)
  }

  async addDirect(
    seed: IngestAddTvDirectSeed,
    options?: TvAddDirectOptions
  ): Promise<IngestAddTvDirectResult> {
    const normalizedLookup = normalizeLookup({
      name: seed.name,
      knownIds: seed.knownIds
    })
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      label: this.i18nService.messages.ingest.add.checkingExisting({ entity: 'tv' }),
      phaseCurrent: 1,
      phaseTotal: 2
    })
    const existing = this.tryResolveExistingTv(normalizedLookup.knownIds, options)
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
      label: this.i18nService.messages.ingest.add.writing({ entity: 'tv' }),
      phaseCurrent: 2,
      phaseTotal: 2
    })
    const graph = buildDirectTvGraph(normalizedLookup)
    const result = await this.persistHandler.persistTvGraph(graph, options)
    this.hooks.committed.dispatch({
      entityId: result.tvId,
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
      operation: 'ingest.tv.add',
      title: this.i18nService.messages.ingest.add.title({ entity: 'tv' }),
      label,
      subject: { type: 'tv' },
      initiator
    })
  }

  private async handleAddFromScraperWithTaskRun(
    run: TaskRunHandle,
    profileId: string,
    lookup: TvScraperLookup,
    options?: TvAddFromScraperTaskRunOptions
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
    seed: IngestAddTvDirectSeed,
    options?: TvAddDirectTaskRunOptions
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
    result: IngestAddTvFromScraperResult | IngestAddTvDirectResult
  ): void {
    const warningItems = toTaskRunWarnings(result.warnings)
    run.complete({
      title: result.isNew
        ? this.i18nService.messages.ingest.add.addedTitle({ entity: 'tv' })
        : this.i18nService.messages.ingest.add.existsTitle({ entity: 'tv' }),
      summary: result.isNew
        ? this.i18nService.messages.ingest.add.addedSummary({ entity: 'tv' })
        : this.i18nService.messages.ingest.add.existsSummary({ entity: 'tv' }),
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
        summary: this.i18nService.messages.ingest.add.cancelledSummary({ entity: 'tv' })
      })
      return
    }

    run.fail(error)
  }

  private tryResolveExistingTv(
    knownIds: TvScraperLookup['knownIds'],
    options?: TvAddDirectOptions | TvAddFromScraperOptions
  ): IngestAddTvDirectResult | undefined {
    if (options?.tvDirPath) {
      const existingByPath = this.dbService.entityFinder.findExistingTv({
        path: options.tvDirPath
      })
      if (existingByPath) {
        addTvToCollection(this.dbService, existingByPath.id, options.targetCollectionId)
        return {
          tvId: existingByPath.id,
          isNew: false,
          existingReason: 'path'
        }
      }
    }

    if (knownIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExistingTv({
        externalIds: knownIds
      })
      if (existingByExternalId) {
        addTvToCollection(this.dbService, existingByExternalId.id, options?.targetCollectionId)
        return {
          tvId: existingByExternalId.id,
          isNew: false,
          existingReason: 'externalId'
        }
      }
    }

    return undefined
  }
}
