import { eq } from 'drizzle-orm'
import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import { isCancellation, type TaskRunHandle, type TaskRunService } from '@main/services/task-run'
import type { IngestPersistHandlers } from '../../persist'
import { requireIngestAllowed, type IngestEntityHooks } from '../../hooks'
import { flushPendingAssets } from '../../assets'
import { buildDirectGameGraph, buildGameGraph } from '../../graph'
import {
  GAME_UPDATE_CORE_SURFACES,
  GAME_UPDATE_MEDIA_SURFACES,
  GAME_UPDATE_RELATION_SURFACES,
  GAME_UPDATE_SURFACE_KEYS,
  type GameUpdateRequest
} from '@shared/ingest/update'
import { games } from '@shared/db'
import type { IngestUpdateResult } from '@shared/ingest'
import type { GameScraperLookup } from '@shared/scraper'
import type { TaskRunStartResult } from '@shared/task-run'
import { createUnresolvedRelatedEntriesWarning } from '../../persist/media-relations'
import { applyGamePlan } from './apply'
import { loadGameCurrent } from './current'
import { buildGameIncoming } from './incoming'
import { buildGamePlan } from './plan'
import { createLinkDegradeWarnings, GAME_LINK_TOPOLOGY } from '../link-topology'
import { normalizeLookup } from '../../normalization'
import { normalizePolicy } from '../shared/policy'
import { requireUpdateRequest } from '../shared/request'
import { normalizeSelection, resolveUpdateSelection } from '../shared/selection'
import { reportIngestProgress } from '../../run/progress'
import { throwIfIngestAborted } from '../../run/abort'
import type { IngestOperationOptions, IngestTaskRunOptions } from '../../types'
import { createIngestRun, toTaskRunWarnings, waitForIngestRunOutput } from '../../run/task-run'

const log = createLogger('Ingest')

export class GameUpdateHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandlers: IngestPersistHandlers,
    private readonly taskRunService: TaskRunService,
    private readonly i18nService: I18nService,
    private readonly hooks: IngestEntityHooks
  ) {}

  startUpdateFromScraper(
    request: GameUpdateRequest,
    options?: IngestTaskRunOptions
  ): TaskRunStartResult {
    requireUpdateRequest(request)
    const run = createIngestRun(this.taskRunService, {
      operation: 'ingest.game.update',
      title: this.i18nService.messages.ingest.update.title({ entity: 'game' }),
      label: request.lookup.name,
      subject: { type: 'game', id: request.rootId },
      initiator: options?.taskRunInitiator
    })

    void this.handleUpdateFromScraperWithTaskRun(run, request)
    return { runId: run.id, createdAt: run.createdAt }
  }

  async updateFromScraperWithTaskRun(
    request: GameUpdateRequest,
    options?: IngestTaskRunOptions
  ): Promise<IngestUpdateResult> {
    const start = this.startUpdateFromScraper(request, options)
    return waitForIngestRunOutput<IngestUpdateResult>(this.taskRunService, start.runId)
  }

  async updateFromScraper(
    request: GameUpdateRequest,
    options?: IngestOperationOptions
  ): Promise<IngestUpdateResult> {
    requireUpdateRequest(request)
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'preparing',
      label: this.i18nService.messages.ingest.update.preparing({ entity: 'game' })
    })
    const lookup = this.resolveLookup(request)
    const surfaces = normalizeSelection(request.selection.surfaces, GAME_UPDATE_SURFACE_KEYS)
    const selection = resolveUpdateSelection({
      surfaces,
      coreSurfaces: GAME_UPDATE_CORE_SURFACES,
      mediaSurfaces: GAME_UPDATE_MEDIA_SURFACES,
      relationSurfaces: GAME_UPDATE_RELATION_SURFACES
    })
    const policy = normalizePolicy(request.policy)

    reportIngestProgress(options, {
      phase: 'scraping',
      label: this.i18nService.messages.ingest.update.scrapingMetadata({ entity: 'game' })
    })
    const bundle = await this.scraperService.game.scrape(request.profileId, lookup, {
      signal: options?.signal
    })
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'planning',
      label: this.i18nService.messages.ingest.update.planning({ entity: 'game' })
    })
    const incoming = buildGameIncoming(bundle, lookup)
    const relationGraph =
      selection.relationSurfaces.length > 0
        ? bundle
          ? buildGameGraph(bundle, lookup)
          : buildDirectGameGraph(lookup)
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
      label: this.i18nService.messages.ingest.update.writing({ entity: 'game' })
    })
    // Read, plan and apply share one synchronous transaction: planning against a
    // snapshot taken outside it would overwrite concurrent edits.
    const { applyResult, degradedLinks } = this.dbService.client.transaction((tx) => {
      const current = loadGameCurrent(tx, request.rootId, selection)
      const plan = buildGamePlan({
        current,
        incoming,
        relationGraph,
        selection,
        policy
      })
      return {
        applyResult: applyGamePlan(tx, request.rootId, plan, this.persistHandlers),
        degradedLinks: plan.degradedLinks
      }
    })

    if (applyResult.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: this.i18nService.messages.ingest.persist.savingMedia({ entity: 'game' })
      })
    }
    const warnings = [
      ...createLinkDegradeWarnings({
        topology: GAME_LINK_TOPOLOGY,
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
      log.warn('Game update completed with warnings.', {
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
   * release of a title from the next.
   */
  private resolveLookup(request: GameUpdateRequest): GameScraperLookup {
    const lookup = normalizeLookup(request.lookup)
    if (lookup.releaseDate) {
      return lookup
    }

    const stored = this.dbService.client
      .select({ releaseDate: games.releaseDate })
      .from(games)
      .where(eq(games.id, request.rootId))
      .get()

    return { ...lookup, releaseDate: stored?.releaseDate ?? undefined }
  }

  private async handleUpdateFromScraperWithTaskRun(
    run: TaskRunHandle,
    request: GameUpdateRequest
  ): Promise<void> {
    try {
      run.start()
      const result = await this.updateFromScraper(request, {
        signal: run.context.signal,
        onProgress: (update) => run.context.report(update)
      })
      run.complete({
        title: this.i18nService.messages.ingest.update.completedTitle({ entity: 'game' }),
        summary: this.i18nService.messages.ingest.update.completedSummary({ entity: 'game' }),
        output: {
          gameId: request.rootId,
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
          summary: this.i18nService.messages.ingest.update.cancelledSummary({ entity: 'game' })
        })
        return
      }

      run.fail(error)
    }
  }
}
