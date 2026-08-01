import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunHandle, TaskRunService } from '@main/services/task-run'
import { isTaskRunCancellation } from '@main/services/task-run'
import type { IngestPersistHandlers } from '../persist'
import { requireIngestAllowed, type IngestEntityHooks } from '../hooks'
import { flushPendingAssets } from '../assets'
import { buildDirectGameGraph, buildGameGraph } from '../graph'
import {
  GAME_UPDATE_CORE_SURFACES,
  GAME_UPDATE_MEDIA_SURFACES,
  GAME_UPDATE_RELATION_SURFACES,
  GAME_UPDATE_SURFACE_KEYS,
  type GameUpdateRequest
} from '@shared/ingest/update'
import type { IngestUpdateResult } from '@shared/ingest'
import type { TaskRunStartResult } from '@shared/task-run'
import { applyGamePlan } from './apply'
import { loadGameCurrent } from './current'
import { buildGameIncoming } from './incoming'
import { buildGamePlan } from './plan'
import { normalizeLookup } from './shared/normalization'
import { normalizePolicy } from './shared/policy'
import { normalizeSelection, resolveUpdateSelection } from './shared/selection'
import {
  reportIngestProgress,
  throwIfIngestAborted,
  type IngestOperationOptions,
  type IngestTaskRunOptions
} from '../types'
import { toTaskRunWarnings, waitForIngestRunOutput } from '../task-run'

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
    this.validateRequest(request)
    const run = this.taskRunService.runs.create({
      category: 'ingest',
      operation: 'ingest.game.update',
      title: this.i18nService.messages.ingest.update.title({ entity: 'game' }),
      description: request.lookup.name,
      owner: { type: 'app' },
      initiator: options?.taskRunInitiator ?? { type: 'user' },
      subject: { type: 'game', id: request.rootId, labelSnapshot: request.lookup.name },
      controls: { cancelable: true, pausable: false },
      presentation: {
        notify: {
          enabled: true,
          title: this.i18nService.messages.ingest.update.title({ entity: 'game' }),
          showProgress: true,
          showResult: true,
          closable: true
        }
      }
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
    this.validateRequest(request)
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'preparing',
      label: this.i18nService.messages.ingest.update.preparing({ entity: 'game' })
    })
    const lookup = normalizeLookup(request.lookup)
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
    const bundle = await this.scraperService.game.scrape(request.profileId, lookup)
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
    const current = loadGameCurrent(this.dbService.client, request.rootId, selection)
    const plan = buildGamePlan({
      current,
      incoming,
      relationGraph,
      selection,
      policy
    })

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
    const applyResult = this.dbService.client.transaction((tx) =>
      applyGamePlan(tx, request.rootId, plan, this.persistHandlers)
    )

    if (applyResult.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: this.i18nService.messages.ingest.persist.savingMedia({ entity: 'game' })
      })
    }
    const warnings = await flushPendingAssets(this.dbService, applyResult.pendingAssets, {
      signal: options?.signal
    })
    if (warnings.length > 0) {
      log.warn('Game update completed with asset warnings.', {
        warningsItemsText: warnings.map((warning) => warning.message).join(' | ')
      })
    }

    this.hooks.updated.dispatch({ entityId: request.rootId, surfaces, warnings })
    return warnings.length > 0 ? { warnings } : {}
  }

  private validateRequest(request: GameUpdateRequest): void {
    if (!request.rootId) {
      throw new Error('Update rootId is required')
    }
    if (!request.profileId) {
      throw new Error('Update profileId is required')
    }
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
      run.context.throwIfCancelled()
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
      if (isTaskRunCancellation(error)) {
        run.cancel({
          summary: this.i18nService.messages.ingest.update.cancelledSummary({ entity: 'game' })
        })
        return
      }

      run.fail(error)
    }
  }
}
