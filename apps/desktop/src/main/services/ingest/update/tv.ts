import { eq } from 'drizzle-orm'
import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import { isCancellation, type TaskRunHandle, type TaskRunService } from '@main/services/task-run'
import type { IngestPersistHandlers } from '../persist'
import { requireIngestAllowed, type IngestEntityHooks } from '../hooks'
import { flushPendingAssets } from '../assets'
import { buildDirectTvGraph, buildTvGraph } from '../graph'
import {
  TV_UPDATE_CORE_SURFACES,
  TV_UPDATE_MEDIA_SURFACES,
  TV_UPDATE_RELATION_SURFACES,
  TV_UPDATE_SURFACE_KEYS,
  type TvUpdateRequest
} from '@shared/ingest/update'
import { tvs } from '@shared/db'
import type { IngestUpdateResult } from '@shared/ingest'
import type { TvScraperLookup } from '@shared/scraper'
import type { TaskRunStartResult } from '@shared/task-run'
import { createUnresolvedRelatedEntriesWarning } from '../media-relations'
import { applyTvPlan } from './apply'
import { loadTvCurrent } from './current'
import { buildTvIncoming } from './incoming'
import { buildTvPlan } from './plan'
import { TV_LINK_TOPOLOGY, createLinkDegradeWarnings } from './link-topology'
import { normalizeLookup } from './shared/normalization'
import { normalizePolicy } from './shared/policy'
import { requireUpdateRequest } from './shared/request'
import { normalizeSelection, resolveUpdateSelection } from './shared/selection'
import { reportIngestProgress } from '../progress'
import { throwIfIngestAborted } from '../abort'
import type { IngestOperationOptions, IngestTaskRunOptions } from '../types'
import { createIngestRun, toTaskRunWarnings, waitForIngestRunOutput } from '../task-run'

const log = createLogger('Ingest')

export class TvUpdateHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandlers: IngestPersistHandlers,
    private readonly taskRunService: TaskRunService,
    private readonly i18nService: I18nService,
    private readonly hooks: IngestEntityHooks
  ) {}

  startUpdateFromScraper(
    request: TvUpdateRequest,
    options?: IngestTaskRunOptions
  ): TaskRunStartResult {
    requireUpdateRequest(request)
    const run = createIngestRun(this.taskRunService, {
      operation: 'ingest.tv.update',
      title: this.i18nService.messages.ingest.update.title({ entity: 'tv' }),
      label: request.lookup.name,
      subject: { type: 'tv', id: request.rootId },
      initiator: options?.taskRunInitiator
    })

    void this.handleUpdateFromScraperWithTaskRun(run, request)
    return { runId: run.id, createdAt: run.createdAt }
  }

  async updateFromScraperWithTaskRun(
    request: TvUpdateRequest,
    options?: IngestTaskRunOptions
  ): Promise<IngestUpdateResult> {
    const start = this.startUpdateFromScraper(request, options)
    return waitForIngestRunOutput<IngestUpdateResult>(this.taskRunService, start.runId)
  }

  async updateFromScraper(
    request: TvUpdateRequest,
    options?: IngestOperationOptions
  ): Promise<IngestUpdateResult> {
    requireUpdateRequest(request)
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'preparing',
      label: this.i18nService.messages.ingest.update.preparing({ entity: 'tv' })
    })
    const lookup = this.resolveLookup(request)
    const surfaces = normalizeSelection(request.selection.surfaces, TV_UPDATE_SURFACE_KEYS)
    const selection = resolveUpdateSelection({
      surfaces,
      coreSurfaces: TV_UPDATE_CORE_SURFACES,
      mediaSurfaces: TV_UPDATE_MEDIA_SURFACES,
      relationSurfaces: TV_UPDATE_RELATION_SURFACES
    })
    const policy = normalizePolicy(request.policy)

    reportIngestProgress(options, {
      phase: 'scraping',
      label: this.i18nService.messages.ingest.update.scrapingMetadata({ entity: 'tv' })
    })
    const bundle = await this.scraperService.tv.scrape(request.profileId, lookup, {
      signal: options?.signal
    })
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'planning',
      label: this.i18nService.messages.ingest.update.planning({ entity: 'tv' })
    })
    const incoming = buildTvIncoming(bundle, lookup)
    const relationGraph =
      selection.relationSurfaces.length > 0
        ? bundle
          ? buildTvGraph(bundle, lookup)
          : buildDirectTvGraph(lookup)
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
      label: this.i18nService.messages.ingest.update.writing({ entity: 'tv' })
    })
    // Read, plan and apply share one synchronous transaction: planning against a
    // snapshot taken outside it would overwrite concurrent edits.
    const { applyResult, degradedLinks } = this.dbService.client.transaction((tx) => {
      const current = loadTvCurrent(tx, request.rootId, selection)
      const plan = buildTvPlan({
        current,
        incoming,
        relationGraph,
        selection,
        policy
      })
      return {
        applyResult: applyTvPlan(tx, request.rootId, plan, this.persistHandlers),
        degradedLinks: plan.degradedLinks
      }
    })

    if (applyResult.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: this.i18nService.messages.ingest.persist.savingMedia({ entity: 'tv' })
      })
    }
    const warnings = [
      ...createLinkDegradeWarnings({
        topology: TV_LINK_TOPOLOGY,
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
      log.warn('TV update completed with warnings.', {
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
   * entry's own row, so providers the entry has no id for can still tell a
   * remake from the show it remakes.
   */
  private resolveLookup(request: TvUpdateRequest): TvScraperLookup {
    const lookup = normalizeLookup(request.lookup)
    if (lookup.releaseDate && lookup.format) {
      return lookup
    }

    const stored = this.dbService.client
      .select({ releaseDate: tvs.releaseDate, format: tvs.format })
      .from(tvs)
      .where(eq(tvs.id, request.rootId))
      .get()

    return {
      ...lookup,
      releaseDate: lookup.releaseDate ?? stored?.releaseDate ?? undefined,
      format: lookup.format ?? stored?.format
    }
  }

  private async handleUpdateFromScraperWithTaskRun(
    run: TaskRunHandle,
    request: TvUpdateRequest
  ): Promise<void> {
    try {
      run.start()
      const result = await this.updateFromScraper(request, {
        signal: run.context.signal,
        onProgress: (update) => run.context.report(update)
      })
      run.complete({
        title: this.i18nService.messages.ingest.update.completedTitle({ entity: 'tv' }),
        summary: this.i18nService.messages.ingest.update.completedSummary({ entity: 'tv' }),
        output: {
          tvId: request.rootId,
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
          summary: this.i18nService.messages.ingest.update.cancelledSummary({ entity: 'tv' })
        })
        return
      }

      run.fail(error)
    }
  }
}
