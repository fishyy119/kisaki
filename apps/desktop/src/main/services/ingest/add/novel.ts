import type {
  IngestAddNovelDirectOptions,
  IngestAddNovelDirectResult,
  IngestAddNovelDirectSeed,
  IngestAddNovelFromScraperOptions,
  IngestAddNovelFromScraperResult
} from '@shared/ingest/add'
import type { NovelScraperLookup } from '@shared/scraper'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import { isCancellation, type TaskRunHandle, type TaskRunService } from '@main/services/task-run'
import type { TaskRunStartResult } from '@shared/task-run'
import type { NovelIngestPersistHandler } from '../persist'
import { requireIngestAllowed, type IngestEntityHooks } from '../hooks'
import { buildNovelGraph, buildDirectNovelGraph } from '../graph'
import {
  addNovelToCollection,
  normalizeIngestLookupInput,
  normalizeLookup,
  requireScrapedBundle
} from './common'
import { reportIngestProgress } from '../progress'
import { throwIfIngestAborted } from '../abort'
import type { IngestOperationOptions, IngestTaskRunOptions } from '../types'
import { createIngestRun, toTaskRunWarnings, waitForIngestRunOutput } from '../task-run'

type NovelAddFromScraperOptions = IngestAddNovelFromScraperOptions & IngestOperationOptions
type NovelAddDirectOptions = IngestAddNovelDirectOptions & IngestOperationOptions
type NovelAddFromScraperTaskRunOptions = IngestAddNovelFromScraperOptions & IngestTaskRunOptions
type NovelAddDirectTaskRunOptions = IngestAddNovelDirectOptions & IngestTaskRunOptions

export class NovelAddHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandler: NovelIngestPersistHandler,
    private readonly taskRunService: TaskRunService,
    private readonly i18nService: I18nService,
    private readonly hooks: IngestEntityHooks
  ) {}

  startAddFromScraper(
    profileId: string,
    lookup: NovelScraperLookup,
    options?: NovelAddFromScraperTaskRunOptions
  ): TaskRunStartResult {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    const run = this.createRun(normalized.lookup.name, options?.taskRunInitiator)

    void this.handleAddFromScraperWithTaskRun(run, normalized.profileId, normalized.lookup, options)
    return { runId: run.id, createdAt: run.createdAt }
  }

  startAddDirect(
    seed: IngestAddNovelDirectSeed,
    options?: NovelAddDirectTaskRunOptions
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
    lookup: NovelScraperLookup,
    options?: NovelAddFromScraperTaskRunOptions
  ): Promise<IngestAddNovelFromScraperResult> {
    const start = this.startAddFromScraper(profileId, lookup, options)
    return waitForIngestRunOutput<IngestAddNovelFromScraperResult>(this.taskRunService, start.runId)
  }

  async addFromScraper(
    profileId: string,
    lookup: NovelScraperLookup,
    options?: NovelAddFromScraperOptions
  ): Promise<IngestAddNovelFromScraperResult> {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      label: this.i18nService.messages.ingest.add.checkingExisting({ entity: 'novel' })
    })
    const existing = this.tryResolveExistingNovel(normalized.lookup.knownIds, options)
    if (existing) {
      return existing
    }

    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'scraping',
      label: this.i18nService.messages.ingest.add.scrapingMetadata({ entity: 'novel' })
    })
    const bundle = requireScrapedBundle(
      await this.scraperService.novel.scrape(normalized.profileId, normalized.lookup, {
        signal: options?.signal
      }),
      'novel'
    )
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'building',
      label: this.i18nService.messages.ingest.add.buildingMetadata({ entity: 'novel' })
    })
    const graph = buildNovelGraph(bundle, normalized.lookup)
    await requireIngestAllowed(this.hooks.committing, {
      name: normalized.lookup.name,
      externalIds: bundle.identity.externalIds
    })
    reportIngestProgress(options, {
      phase: 'writing',
      label: this.i18nService.messages.ingest.add.writing({ entity: 'novel' })
    })
    const result = await this.persistHandler.persistNovelGraph(graph, options)
    this.hooks.committed.dispatch({
      entityId: result.novelId,
      isNew: result.isNew,
      warnings: result.warnings ?? []
    })
    return result
  }

  async addDirectWithTaskRun(
    seed: IngestAddNovelDirectSeed,
    options?: NovelAddDirectTaskRunOptions
  ): Promise<IngestAddNovelDirectResult> {
    const start = this.startAddDirect(seed, options)
    return waitForIngestRunOutput<IngestAddNovelDirectResult>(this.taskRunService, start.runId)
  }

  async addDirect(
    seed: IngestAddNovelDirectSeed,
    options?: NovelAddDirectOptions
  ): Promise<IngestAddNovelDirectResult> {
    const normalizedLookup = normalizeLookup({
      name: seed.name,
      knownIds: seed.knownIds
    })
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      label: this.i18nService.messages.ingest.add.checkingExisting({ entity: 'novel' }),
      phaseCurrent: 1,
      phaseTotal: 2
    })
    const existing = this.tryResolveExistingNovel(normalizedLookup.knownIds, options)
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
      label: this.i18nService.messages.ingest.add.writing({ entity: 'novel' }),
      phaseCurrent: 2,
      phaseTotal: 2
    })
    const graph = buildDirectNovelGraph(normalizedLookup)
    const result = await this.persistHandler.persistNovelGraph(graph, options)
    this.hooks.committed.dispatch({
      entityId: result.novelId,
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
      operation: 'ingest.novel.add',
      title: this.i18nService.messages.ingest.add.title({ entity: 'novel' }),
      label,
      subject: { type: 'novel' },
      initiator
    })
  }

  private async handleAddFromScraperWithTaskRun(
    run: TaskRunHandle,
    profileId: string,
    lookup: NovelScraperLookup,
    options?: NovelAddFromScraperTaskRunOptions
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
    seed: IngestAddNovelDirectSeed,
    options?: NovelAddDirectTaskRunOptions
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
    result: IngestAddNovelFromScraperResult | IngestAddNovelDirectResult
  ): void {
    const warningItems = toTaskRunWarnings(result.warnings)
    run.complete({
      title: result.isNew
        ? this.i18nService.messages.ingest.add.addedTitle({ entity: 'novel' })
        : this.i18nService.messages.ingest.add.existsTitle({ entity: 'novel' }),
      summary: result.isNew
        ? this.i18nService.messages.ingest.add.addedSummary({ entity: 'novel' })
        : this.i18nService.messages.ingest.add.existsSummary({ entity: 'novel' }),
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
        summary: this.i18nService.messages.ingest.add.cancelledSummary({ entity: 'novel' })
      })
      return
    }

    run.fail(error)
  }

  private tryResolveExistingNovel(
    knownIds: NovelScraperLookup['knownIds'],
    options?: NovelAddDirectOptions | NovelAddFromScraperOptions
  ): IngestAddNovelDirectResult | undefined {
    if (options?.novelDirPath) {
      const existingByPath = this.dbService.entityFinder.findExistingNovel({
        path: options.novelDirPath
      })
      if (existingByPath) {
        addNovelToCollection(this.dbService, existingByPath.id, options.targetCollectionId)
        return {
          novelId: existingByPath.id,
          isNew: false,
          existingReason: 'path'
        }
      }
    }

    if (knownIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExistingNovel({
        externalIds: knownIds
      })
      if (existingByExternalId) {
        addNovelToCollection(this.dbService, existingByExternalId.id, options?.targetCollectionId)
        return {
          novelId: existingByExternalId.id,
          isNew: false,
          existingReason: 'externalId'
        }
      }
    }

    return undefined
  }
}
