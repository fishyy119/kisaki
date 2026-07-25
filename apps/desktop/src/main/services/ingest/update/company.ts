import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunHandle, TaskRunService } from '@main/services/task-run'
import { isTaskRunCancellation } from '@main/services/task-run'
import { flushPendingAssets } from '../assets'
import {
  COMPANY_UPDATE_CORE_SURFACES,
  COMPANY_UPDATE_MEDIA_SURFACES,
  COMPANY_UPDATE_SURFACE_KEYS,
  type CompanyUpdateRequest
} from '@shared/ingest/update'
import type { IngestUpdateResult } from '@shared/ingest'
import type { TaskRunStartResult } from '@shared/task-run'
import { applyCompanyPlan } from './apply'
import { loadCompanyCurrent } from './current'
import { buildCompanyIncoming } from './incoming'
import { buildCompanyPlan } from './plan'
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

export class CompanyUpdateHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly taskRunService: TaskRunService,
    private readonly i18nService: I18nService
  ) {}

  startUpdateFromScraper(
    request: CompanyUpdateRequest,
    options?: IngestTaskRunOptions
  ): TaskRunStartResult {
    this.validateRequest(request)
    const run = this.taskRunService.runs.create({
      category: 'ingest',
      operation: 'ingest.company.update',
      title: this.i18nService.messages.ingest.update.title({ entity: 'company' }),
      description: request.lookup.name,
      owner: { type: 'app' },
      initiator: options?.taskRunInitiator ?? { type: 'user' },
      subject: { type: 'company', id: request.rootId, labelSnapshot: request.lookup.name },
      controls: { cancelable: true, pausable: false },
      presentation: {
        notify: {
          enabled: true,
          title: this.i18nService.messages.ingest.update.title({ entity: 'company' }),
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
    request: CompanyUpdateRequest,
    options?: IngestTaskRunOptions
  ): Promise<IngestUpdateResult> {
    const start = this.startUpdateFromScraper(request, options)
    return waitForIngestRunOutput<IngestUpdateResult>(this.taskRunService, start.runId)
  }

  async updateFromScraper(
    request: CompanyUpdateRequest,
    options?: IngestOperationOptions
  ): Promise<IngestUpdateResult> {
    this.validateRequest(request)
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'preparing',
      label: this.i18nService.messages.ingest.update.preparing({ entity: 'company' })
    })
    const lookup = normalizeLookup(request.lookup)
    const surfaces = normalizeSelection(request.selection.surfaces, COMPANY_UPDATE_SURFACE_KEYS)
    const selection = resolveUpdateSelection({
      surfaces,
      coreSurfaces: COMPANY_UPDATE_CORE_SURFACES,
      mediaSurfaces: COMPANY_UPDATE_MEDIA_SURFACES
    })
    const policy = normalizePolicy(request.policy)

    reportIngestProgress(options, {
      phase: 'scraping',
      label: this.i18nService.messages.ingest.update.scrapingMetadata({ entity: 'company' })
    })
    const bundle = await this.scraperService.company.scrape(request.profileId, lookup)
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'planning',
      label: this.i18nService.messages.ingest.update.planning({ entity: 'company' })
    })
    const incoming = buildCompanyIncoming(bundle, lookup)
    const current = loadCompanyCurrent(this.dbService.client, request.rootId, selection)
    const plan = buildCompanyPlan({
      current,
      incoming,
      selection,
      policy
    })

    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'writing',
      label: this.i18nService.messages.ingest.update.writing({ entity: 'company' })
    })
    const applyResult = this.dbService.client.transaction((tx) =>
      applyCompanyPlan(tx, request.rootId, plan)
    )

    if (applyResult.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: this.i18nService.messages.ingest.persist.savingMedia({ entity: 'company' })
      })
    }
    const warnings = await flushPendingAssets(this.dbService, applyResult.pendingAssets, {
      signal: options?.signal
    })
    if (warnings.length > 0) {
      log.warn('Company update completed with asset warnings.', {
        warningsItemsText: warnings.map((warning) => warning.message).join(' | ')
      })
    }

    return warnings.length > 0 ? { warnings } : {}
  }

  private validateRequest(request: CompanyUpdateRequest): void {
    if (!request.rootId) {
      throw new Error('Update rootId is required')
    }
    if (!request.profileId) {
      throw new Error('Update profileId is required')
    }
  }

  private async handleUpdateFromScraperWithTaskRun(
    run: TaskRunHandle,
    request: CompanyUpdateRequest
  ): Promise<void> {
    try {
      run.start()
      const result = await this.updateFromScraper(request, {
        signal: run.context.signal,
        onProgress: (update) => run.context.report(update)
      })
      run.context.throwIfCancelled()
      run.complete({
        title: this.i18nService.messages.ingest.update.completedTitle({ entity: 'company' }),
        summary: this.i18nService.messages.ingest.update.completedSummary({ entity: 'company' }),
        output: {
          companyId: request.rootId,
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
          summary: this.i18nService.messages.ingest.update.cancelledSummary({ entity: 'company' })
        })
        return
      }

      run.fail(error)
    }
  }
}
