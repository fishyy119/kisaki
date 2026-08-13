import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import { isCancellation, type TaskRunHandle, type TaskRunService } from '@main/services/task-run'
import type { IngestPersistHandlers } from '../persist'
import { requireIngestAllowed, type IngestEntityHooks } from '../hooks'
import { flushPendingAssets } from '../assets'
import { buildAnimeGraph, buildDirectAnimeGraph } from '../graph'
import {
  ANIME_UPDATE_CORE_SURFACES,
  ANIME_UPDATE_MEDIA_SURFACES,
  ANIME_UPDATE_RELATION_SURFACES,
  ANIME_UPDATE_SURFACE_KEYS,
  type AnimeUpdateRequest
} from '@shared/ingest/update'
import type { IngestUpdateResult } from '@shared/ingest'
import type { TaskRunStartResult } from '@shared/task-run'
import { createUnresolvedRelatedEntriesWarning } from '../media-relations'
import { applyAnimePlan } from './apply'
import { loadAnimeCurrent } from './current'
import { buildAnimeIncoming } from './incoming'
import { buildAnimePlan } from './plan'
import { ANIME_LINK_TOPOLOGY, createLinkDegradeWarnings } from './link-topology'
import { normalizeLookup } from './shared/normalization'
import { normalizePolicy } from './shared/policy'
import { requireUpdateRequest } from './shared/request'
import { normalizeSelection, resolveUpdateSelection } from './shared/selection'
import { reportIngestProgress } from '../progress'
import { throwIfIngestAborted } from '../abort'
import type { IngestOperationOptions, IngestTaskRunOptions } from '../types'
import { createIngestRun, toTaskRunWarnings, waitForIngestRunOutput } from '../task-run'

const log = createLogger('Ingest')

export class AnimeUpdateHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandlers: IngestPersistHandlers,
    private readonly taskRunService: TaskRunService,
    private readonly i18nService: I18nService,
    private readonly hooks: IngestEntityHooks
  ) {}

  startUpdateFromScraper(
    request: AnimeUpdateRequest,
    options?: IngestTaskRunOptions
  ): TaskRunStartResult {
    requireUpdateRequest(request)
    const run = createIngestRun(this.taskRunService, {
      operation: 'ingest.anime.update',
      title: this.i18nService.messages.ingest.update.title({ entity: 'anime' }),
      label: request.lookup.name,
      subject: { type: 'anime', id: request.rootId },
      initiator: options?.taskRunInitiator
    })

    void this.handleUpdateFromScraperWithTaskRun(run, request)
    return { runId: run.id, createdAt: run.createdAt }
  }

  async updateFromScraperWithTaskRun(
    request: AnimeUpdateRequest,
    options?: IngestTaskRunOptions
  ): Promise<IngestUpdateResult> {
    const start = this.startUpdateFromScraper(request, options)
    return waitForIngestRunOutput<IngestUpdateResult>(this.taskRunService, start.runId)
  }

  async updateFromScraper(
    request: AnimeUpdateRequest,
    options?: IngestOperationOptions
  ): Promise<IngestUpdateResult> {
    requireUpdateRequest(request)
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'preparing',
      label: this.i18nService.messages.ingest.update.preparing({ entity: 'anime' })
    })
    const lookup = normalizeLookup(request.lookup)
    const surfaces = normalizeSelection(request.selection.surfaces, ANIME_UPDATE_SURFACE_KEYS)
    const selection = resolveUpdateSelection({
      surfaces,
      coreSurfaces: ANIME_UPDATE_CORE_SURFACES,
      mediaSurfaces: ANIME_UPDATE_MEDIA_SURFACES,
      relationSurfaces: ANIME_UPDATE_RELATION_SURFACES
    })
    const policy = normalizePolicy(request.policy)

    reportIngestProgress(options, {
      phase: 'scraping',
      label: this.i18nService.messages.ingest.update.scrapingMetadata({ entity: 'anime' })
    })
    const bundle = await this.scraperService.anime.scrape(request.profileId, lookup, {
      signal: options?.signal
    })
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'planning',
      label: this.i18nService.messages.ingest.update.planning({ entity: 'anime' })
    })
    const incoming = buildAnimeIncoming(bundle, lookup)
    const relationGraph =
      selection.relationSurfaces.length > 0
        ? bundle
          ? buildAnimeGraph(bundle, lookup)
          : buildDirectAnimeGraph(lookup)
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
      label: this.i18nService.messages.ingest.update.writing({ entity: 'anime' })
    })
    // Read, plan and apply share one synchronous transaction: planning against a
    // snapshot taken outside it would overwrite concurrent edits.
    const { applyResult, degradedLinks } = this.dbService.client.transaction((tx) => {
      const current = loadAnimeCurrent(tx, request.rootId, selection)
      const plan = buildAnimePlan({
        current,
        incoming,
        relationGraph,
        selection,
        policy
      })
      return {
        applyResult: applyAnimePlan(tx, request.rootId, plan, this.persistHandlers),
        degradedLinks: plan.degradedLinks
      }
    })

    if (applyResult.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: this.i18nService.messages.ingest.persist.savingMedia({ entity: 'anime' })
      })
    }
    const warnings = [
      ...createLinkDegradeWarnings({
        topology: ANIME_LINK_TOPOLOGY,
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
      log.warn('Anime update completed with warnings.', {
        warningsItemsText: warnings.map((warning) => warning.message).join(' | ')
      })
    }

    this.hooks.updated.dispatch({ entityId: request.rootId, surfaces, warnings })
    return warnings.length > 0 ? { warnings } : {}
  }

  private async handleUpdateFromScraperWithTaskRun(
    run: TaskRunHandle,
    request: AnimeUpdateRequest
  ): Promise<void> {
    try {
      run.start()
      const result = await this.updateFromScraper(request, {
        signal: run.context.signal,
        onProgress: (update) => run.context.report(update)
      })
      run.complete({
        title: this.i18nService.messages.ingest.update.completedTitle({ entity: 'anime' }),
        summary: this.i18nService.messages.ingest.update.completedSummary({ entity: 'anime' }),
        output: {
          animeId: request.rootId,
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
          summary: this.i18nService.messages.ingest.update.cancelledSummary({ entity: 'anime' })
        })
        return
      }

      run.fail(error)
    }
  }
}
