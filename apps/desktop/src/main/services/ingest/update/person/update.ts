import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import { isCancellation, type TaskRunHandle, type TaskRunService } from '@main/services/task-run'
import { requireIngestAllowed, type IngestEntityHooks } from '../../hooks'
import { flushPendingAssets } from '../../assets'
import {
  PERSON_UPDATE_CORE_SURFACES,
  PERSON_UPDATE_MEDIA_SURFACES,
  PERSON_UPDATE_SURFACE_KEYS,
  type PersonUpdateRequest
} from '@shared/ingest/update'
import type { IngestUpdateResult } from '@shared/ingest'
import type { TaskRunStartResult } from '@shared/task-run'
import { applyPersonPlan } from './apply'
import { loadPersonCurrent } from './current'
import { buildPersonIncoming } from './incoming'
import { buildPersonPlan } from './plan'
import { normalizeLookup } from '../../normalization'
import { normalizePolicy } from '../shared/policy'
import { requireUpdateRequest } from '../shared/request'
import { normalizeSelection, resolveUpdateSelection } from '../shared/selection'
import { reportIngestProgress } from '../../run/progress'
import { throwIfIngestAborted } from '../../run/abort'
import type { IngestOperationOptions, IngestTaskRunOptions } from '../../types'
import { createIngestRun, toTaskRunWarnings, waitForIngestRunOutput } from '../../run/task-run'

const log = createLogger('Ingest')

export class PersonUpdateHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly taskRunService: TaskRunService,
    private readonly i18nService: I18nService,
    private readonly hooks: IngestEntityHooks
  ) {}

  startUpdateFromScraper(
    request: PersonUpdateRequest,
    options?: IngestTaskRunOptions
  ): TaskRunStartResult {
    requireUpdateRequest(request)
    const run = createIngestRun(this.taskRunService, {
      operation: 'ingest.person.update',
      title: this.i18nService.messages.ingest.update.title({ entity: 'person' }),
      label: request.lookup.name,
      subject: { type: 'person', id: request.rootId },
      initiator: options?.taskRunInitiator
    })

    void this.handleUpdateFromScraperWithTaskRun(run, request)
    return { runId: run.id, createdAt: run.createdAt }
  }

  async updateFromScraperWithTaskRun(
    request: PersonUpdateRequest,
    options?: IngestTaskRunOptions
  ): Promise<IngestUpdateResult> {
    const start = this.startUpdateFromScraper(request, options)
    return waitForIngestRunOutput<IngestUpdateResult>(this.taskRunService, start.runId)
  }

  async updateFromScraper(
    request: PersonUpdateRequest,
    options?: IngestOperationOptions
  ): Promise<IngestUpdateResult> {
    requireUpdateRequest(request)
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'preparing',
      label: this.i18nService.messages.ingest.update.preparing({ entity: 'person' })
    })
    const lookup = normalizeLookup(request.lookup)
    const surfaces = normalizeSelection(request.selection.surfaces, PERSON_UPDATE_SURFACE_KEYS)
    const selection = resolveUpdateSelection({
      surfaces,
      coreSurfaces: PERSON_UPDATE_CORE_SURFACES,
      mediaSurfaces: PERSON_UPDATE_MEDIA_SURFACES
    })
    const policy = normalizePolicy(request.policy)

    reportIngestProgress(options, {
      phase: 'scraping',
      label: this.i18nService.messages.ingest.update.scrapingMetadata({ entity: 'person' })
    })
    const bundle = await this.scraperService.person.scrape(request.profileId, lookup, {
      signal: options?.signal
    })
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'planning',
      label: this.i18nService.messages.ingest.update.planning({ entity: 'person' })
    })
    const incoming = buildPersonIncoming(bundle, lookup)
    throwIfIngestAborted(options?.signal)
    await requireIngestAllowed(this.hooks.updating, {
      entityId: request.rootId,
      name: lookup.name,
      surfaces,
      externalIds: lookup.knownIds ?? []
    })
    reportIngestProgress(options, {
      phase: 'writing',
      label: this.i18nService.messages.ingest.update.writing({ entity: 'person' })
    })
    // Read, plan and apply share one synchronous transaction: planning against a
    // snapshot taken outside it would overwrite concurrent edits.
    const applyResult = this.dbService.client.transaction((tx) => {
      const current = loadPersonCurrent(tx, request.rootId, selection)
      const plan = buildPersonPlan({
        current,
        incoming,
        selection,
        policy
      })
      return applyPersonPlan(tx, request.rootId, plan)
    })

    if (applyResult.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: this.i18nService.messages.ingest.persist.savingMedia({ entity: 'person' })
      })
    }
    const warnings = await flushPendingAssets(this.dbService, applyResult.pendingAssets, {
      signal: options?.signal
    })
    if (warnings.length > 0) {
      log.warn('Person update completed with asset warnings.', {
        warningsItemsText: warnings.map((warning) => warning.message).join(' | ')
      })
    }

    this.hooks.updated.dispatch({ entityId: request.rootId, surfaces, warnings })
    return warnings.length > 0 ? { warnings } : {}
  }

  private async handleUpdateFromScraperWithTaskRun(
    run: TaskRunHandle,
    request: PersonUpdateRequest
  ): Promise<void> {
    try {
      run.start()
      const result = await this.updateFromScraper(request, {
        signal: run.context.signal,
        onProgress: (update) => run.context.report(update)
      })
      run.complete({
        title: this.i18nService.messages.ingest.update.completedTitle({ entity: 'person' }),
        summary: this.i18nService.messages.ingest.update.completedSummary({ entity: 'person' }),
        output: {
          personId: request.rootId,
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
          summary: this.i18nService.messages.ingest.update.cancelledSummary({ entity: 'person' })
        })
        return
      }

      run.fail(error)
    }
  }
}
