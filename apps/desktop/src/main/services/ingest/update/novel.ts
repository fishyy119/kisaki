import { eq } from 'drizzle-orm'
import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import { isCancellation, type TaskRunHandle, type TaskRunService } from '@main/services/task-run'
import type { IngestPersistHandlers } from '../persist'
import { requireIngestAllowed, type IngestEntityHooks } from '../hooks'
import { flushPendingAssets } from '../assets'
import { buildNovelGraph, buildDirectNovelGraph } from '../graph'
import {
  NOVEL_UPDATE_CORE_SURFACES,
  NOVEL_UPDATE_MEDIA_SURFACES,
  NOVEL_UPDATE_RELATION_SURFACES,
  NOVEL_UPDATE_SURFACE_KEYS,
  type NovelUpdateRequest
} from '@shared/ingest/update'
import { novels } from '@shared/db'
import type { IngestUpdateResult } from '@shared/ingest'
import type { NovelScraperLookup } from '@shared/scraper'
import type { TaskRunStartResult } from '@shared/task-run'
import { createUnresolvedRelatedEntriesWarning } from '../media-relations'
import { applyNovelPlan } from './apply'
import { loadNovelCurrent } from './current'
import { buildNovelIncoming } from './incoming'
import { buildNovelPlan } from './plan'
import { NOVEL_LINK_TOPOLOGY, createLinkDegradeWarnings } from './link-topology'
import { normalizeLookup } from './shared/normalization'
import { normalizePolicy } from './shared/policy'
import { requireUpdateRequest } from './shared/request'
import { normalizeSelection, resolveUpdateSelection } from './shared/selection'
import { reportIngestProgress } from '../progress'
import { throwIfIngestAborted } from '../abort'
import type { IngestOperationOptions, IngestTaskRunOptions } from '../types'
import { createIngestRun, toTaskRunWarnings, waitForIngestRunOutput } from '../task-run'

const log = createLogger('Ingest')

export class NovelUpdateHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandlers: IngestPersistHandlers,
    private readonly taskRunService: TaskRunService,
    private readonly i18nService: I18nService,
    private readonly hooks: IngestEntityHooks
  ) {}

  startUpdateFromScraper(
    request: NovelUpdateRequest,
    options?: IngestTaskRunOptions
  ): TaskRunStartResult {
    requireUpdateRequest(request)
    const run = createIngestRun(this.taskRunService, {
      operation: 'ingest.novel.update',
      title: this.i18nService.messages.ingest.update.title({ entity: 'novel' }),
      label: request.lookup.name,
      subject: { type: 'novel', id: request.rootId },
      initiator: options?.taskRunInitiator
    })

    void this.handleUpdateFromScraperWithTaskRun(run, request)
    return { runId: run.id, createdAt: run.createdAt }
  }

  async updateFromScraperWithTaskRun(
    request: NovelUpdateRequest,
    options?: IngestTaskRunOptions
  ): Promise<IngestUpdateResult> {
    const start = this.startUpdateFromScraper(request, options)
    return waitForIngestRunOutput<IngestUpdateResult>(this.taskRunService, start.runId)
  }

  async updateFromScraper(
    request: NovelUpdateRequest,
    options?: IngestOperationOptions
  ): Promise<IngestUpdateResult> {
    requireUpdateRequest(request)
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'preparing',
      label: this.i18nService.messages.ingest.update.preparing({ entity: 'novel' })
    })
    const lookup = this.resolveLookup(request)
    const surfaces = normalizeSelection(request.selection.surfaces, NOVEL_UPDATE_SURFACE_KEYS)
    const selection = resolveUpdateSelection({
      surfaces,
      coreSurfaces: NOVEL_UPDATE_CORE_SURFACES,
      mediaSurfaces: NOVEL_UPDATE_MEDIA_SURFACES,
      relationSurfaces: NOVEL_UPDATE_RELATION_SURFACES
    })
    const policy = normalizePolicy(request.policy)

    reportIngestProgress(options, {
      phase: 'scraping',
      label: this.i18nService.messages.ingest.update.scrapingMetadata({ entity: 'novel' })
    })
    const bundle = await this.scraperService.novel.scrape(request.profileId, lookup, {
      signal: options?.signal
    })
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'planning',
      label: this.i18nService.messages.ingest.update.planning({ entity: 'novel' })
    })
    const incoming = buildNovelIncoming(bundle, lookup)
    const relationGraph =
      selection.relationSurfaces.length > 0
        ? bundle
          ? buildNovelGraph(bundle, lookup)
          : buildDirectNovelGraph(lookup)
        : undefined
    throwIfIngestAborted(options?.signal)
    await requireIngestAllowed(this.hooks.updating, {
      entityId: request.rootId,
      name: lookup.name,
      surfaces,
      externalIds: lookup.knownIds ?? []
    })
    reportIngestProgress(options, {
      phase: 'writing',
      label: this.i18nService.messages.ingest.update.writing({ entity: 'novel' })
    })
    // Read, plan and apply share one synchronous transaction: planning against a
    // snapshot taken outside it would overwrite concurrent edits.
    const { applyResult, degradedLinks } = this.dbService.client.transaction((tx) => {
      const current = loadNovelCurrent(tx, request.rootId, selection)
      const plan = buildNovelPlan({
        current,
        incoming,
        relationGraph,
        selection,
        policy
      })
      return {
        applyResult: applyNovelPlan(tx, request.rootId, plan, this.persistHandlers),
        degradedLinks: plan.degradedLinks
      }
    })

    if (applyResult.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: this.i18nService.messages.ingest.persist.savingMedia({ entity: 'novel' })
      })
    }
    const warnings = [
      ...createLinkDegradeWarnings({
        topology: NOVEL_LINK_TOPOLOGY,
        degraded: degradedLinks,
        preservedRows: applyResult.preservedLinkRows
      }),
      ...(applyResult.unresolvedRelatedEntries
        ? [createUnresolvedRelatedEntriesWarning(applyResult.unresolvedRelatedEntries)]
        : []),
      ...(await flushPendingAssets(this.dbService, applyResult.pendingAssets, {
        signal: options?.signal
      }))
    ]
    if (warnings.length > 0) {
      log.warn('Novel update completed with warnings.', {
        warningsItemsText: warnings.map((warning) => warning.message).join(' | ')
      })
    }

    this.hooks.updated.dispatch({ entityId: request.rootId, surfaces, warnings })
    return warnings.length > 0 ? { warnings } : {}
  }

  /**
   * Complete the request's lookup with what the stored entry already knows.
   *
   * The caller states the facts of the result it picked, which is authoritative
   * when the update rebinds the entry. Whatever it leaves open falls back to the
   * entry's own row, so providers the entry has no id for can still tell one
   * edition of a work from the next.
   */
  private resolveLookup(request: NovelUpdateRequest): NovelScraperLookup {
    const lookup = normalizeLookup(request.lookup)
    if (lookup.releaseDate && lookup.format) {
      return lookup
    }

    const stored = this.dbService.client
      .select({ releaseDate: novels.releaseDate, format: novels.format })
      .from(novels)
      .where(eq(novels.id, request.rootId))
      .get()

    return {
      ...lookup,
      releaseDate: lookup.releaseDate ?? stored?.releaseDate ?? undefined,
      format: lookup.format ?? stored?.format
    }
  }

  private async handleUpdateFromScraperWithTaskRun(
    run: TaskRunHandle,
    request: NovelUpdateRequest
  ): Promise<void> {
    try {
      run.start()
      const result = await this.updateFromScraper(request, {
        signal: run.context.signal,
        onProgress: (update) => run.context.report(update)
      })
      run.complete({
        title: this.i18nService.messages.ingest.update.completedTitle({ entity: 'novel' }),
        summary: this.i18nService.messages.ingest.update.completedSummary({ entity: 'novel' }),
        output: {
          novelId: request.rootId,
          ...result
        },
        counters: {
          updated: 1,
          warnings: result.warnings?.length ?? 0
        },
        warnings: toTaskRunWarnings(result.warnings)
      })
    } catch (error) {
      if (isCancellation(error)) {
        run.cancel({
          summary: this.i18nService.messages.ingest.update.cancelledSummary({ entity: 'novel' })
        })
        return
      }

      run.fail(error)
    }
  }
}
