import type {
  IngestAddComicDirectOptions,
  IngestAddComicDirectResult,
  IngestAddComicDirectSeed,
  IngestAddComicFromScraperOptions,
  IngestAddComicFromScraperResult
} from '@shared/ingest/add'
import type { ComicScraperLookup } from '@shared/scraper'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import { isCancellation, type TaskRunHandle, type TaskRunService } from '@main/services/task-run'
import type { TaskRunStartResult } from '@shared/task-run'
import type { ComicIngestPersistHandler } from '../persist'
import { requireIngestAllowed, type IngestEntityHooks } from '../hooks'
import { buildComicGraph, buildDirectComicGraph } from '../graph'
import {
  addComicToCollection,
  normalizeIngestLookupInput,
  normalizeLookup,
  requireScrapedBundle
} from './common'
import { reportIngestProgress } from '../progress'
import { throwIfIngestAborted } from '../abort'
import type { IngestOperationOptions, IngestTaskRunOptions } from '../types'
import { createIngestRun, toTaskRunWarnings, waitForIngestRunOutput } from '../task-run'

type ComicAddFromScraperOptions = IngestAddComicFromScraperOptions & IngestOperationOptions
type ComicAddDirectOptions = IngestAddComicDirectOptions & IngestOperationOptions
type ComicAddFromScraperTaskRunOptions = IngestAddComicFromScraperOptions & IngestTaskRunOptions
type ComicAddDirectTaskRunOptions = IngestAddComicDirectOptions & IngestTaskRunOptions

export class ComicAddHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandler: ComicIngestPersistHandler,
    private readonly taskRunService: TaskRunService,
    private readonly i18nService: I18nService,
    private readonly hooks: IngestEntityHooks
  ) {}

  startAddFromScraper(
    profileId: string,
    lookup: ComicScraperLookup,
    options?: ComicAddFromScraperTaskRunOptions
  ): TaskRunStartResult {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    const run = this.createRun(normalized.lookup.name, options?.taskRunInitiator)

    void this.handleAddFromScraperWithTaskRun(run, normalized.profileId, normalized.lookup, options)
    return { runId: run.id, createdAt: run.createdAt }
  }

  startAddDirect(
    seed: IngestAddComicDirectSeed,
    options?: ComicAddDirectTaskRunOptions
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
    lookup: ComicScraperLookup,
    options?: ComicAddFromScraperTaskRunOptions
  ): Promise<IngestAddComicFromScraperResult> {
    const start = this.startAddFromScraper(profileId, lookup, options)
    return waitForIngestRunOutput<IngestAddComicFromScraperResult>(this.taskRunService, start.runId)
  }

  async addFromScraper(
    profileId: string,
    lookup: ComicScraperLookup,
    options?: ComicAddFromScraperOptions
  ): Promise<IngestAddComicFromScraperResult> {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      label: this.i18nService.messages.ingest.add.checkingExisting({ entity: 'comic' })
    })
    const existing = this.tryResolveExistingComic(normalized.lookup.knownIds, options)
    if (existing) {
      return existing
    }

    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'scraping',
      label: this.i18nService.messages.ingest.add.scrapingMetadata({ entity: 'comic' })
    })
    const bundle = requireScrapedBundle(
      await this.scraperService.comic.scrape(normalized.profileId, normalized.lookup, {
        signal: options?.signal
      }),
      'comic'
    )
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'building',
      label: this.i18nService.messages.ingest.add.buildingMetadata({ entity: 'comic' })
    })
    const graph = buildComicGraph(bundle, normalized.lookup)
    await requireIngestAllowed(this.hooks.committing, {
      name: normalized.lookup.name,
      externalIds: bundle.identity.externalIds
    })
    reportIngestProgress(options, {
      phase: 'writing',
      label: this.i18nService.messages.ingest.add.writing({ entity: 'comic' })
    })
    const result = await this.persistHandler.persistComicGraph(graph, options)
    this.hooks.committed.dispatch({
      entityId: result.comicId,
      isNew: result.isNew,
      warnings: result.warnings ?? []
    })
    return result
  }

  async addDirectWithTaskRun(
    seed: IngestAddComicDirectSeed,
    options?: ComicAddDirectTaskRunOptions
  ): Promise<IngestAddComicDirectResult> {
    const start = this.startAddDirect(seed, options)
    return waitForIngestRunOutput<IngestAddComicDirectResult>(this.taskRunService, start.runId)
  }

  async addDirect(
    seed: IngestAddComicDirectSeed,
    options?: ComicAddDirectOptions
  ): Promise<IngestAddComicDirectResult> {
    const normalizedLookup = normalizeLookup({
      name: seed.name,
      knownIds: seed.knownIds
    })
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      label: this.i18nService.messages.ingest.add.checkingExisting({ entity: 'comic' }),
      phaseCurrent: 1,
      phaseTotal: 2
    })
    const existing = this.tryResolveExistingComic(normalizedLookup.knownIds, options)
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
      label: this.i18nService.messages.ingest.add.writing({ entity: 'comic' }),
      phaseCurrent: 2,
      phaseTotal: 2
    })
    const graph = buildDirectComicGraph(normalizedLookup)
    const result = await this.persistHandler.persistComicGraph(graph, options)
    this.hooks.committed.dispatch({
      entityId: result.comicId,
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
      operation: 'ingest.comic.add',
      title: this.i18nService.messages.ingest.add.title({ entity: 'comic' }),
      label,
      subject: { type: 'comic' },
      initiator
    })
  }

  private async handleAddFromScraperWithTaskRun(
    run: TaskRunHandle,
    profileId: string,
    lookup: ComicScraperLookup,
    options?: ComicAddFromScraperTaskRunOptions
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
    seed: IngestAddComicDirectSeed,
    options?: ComicAddDirectTaskRunOptions
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
    result: IngestAddComicFromScraperResult | IngestAddComicDirectResult
  ): void {
    const warningItems = toTaskRunWarnings(result.warnings)
    run.complete({
      title: result.isNew
        ? this.i18nService.messages.ingest.add.addedTitle({ entity: 'comic' })
        : this.i18nService.messages.ingest.add.existsTitle({ entity: 'comic' }),
      summary: result.isNew
        ? this.i18nService.messages.ingest.add.addedSummary({ entity: 'comic' })
        : this.i18nService.messages.ingest.add.existsSummary({ entity: 'comic' }),
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
        summary: this.i18nService.messages.ingest.add.cancelledSummary({ entity: 'comic' })
      })
      return
    }

    run.fail(error)
  }

  private tryResolveExistingComic(
    knownIds: ComicScraperLookup['knownIds'],
    options?: ComicAddDirectOptions | ComicAddFromScraperOptions
  ): IngestAddComicDirectResult | undefined {
    if (options?.comicDirPath) {
      const existingByPath = this.dbService.entityFinder.findExistingComic({
        path: options.comicDirPath
      })
      if (existingByPath) {
        addComicToCollection(this.dbService, existingByPath.id, options.targetCollectionId)
        return {
          comicId: existingByPath.id,
          isNew: false,
          existingReason: 'path'
        }
      }
    }

    if (knownIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExistingComic({
        externalIds: knownIds
      })
      if (existingByExternalId) {
        addComicToCollection(this.dbService, existingByExternalId.id, options?.targetCollectionId)
        return {
          comicId: existingByExternalId.id,
          isNew: false,
          existingReason: 'externalId'
        }
      }
    }

    return undefined
  }
}
