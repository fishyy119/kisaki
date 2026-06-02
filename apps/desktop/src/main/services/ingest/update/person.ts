import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunHandle, TaskRunService } from '@main/services/task-run'
import { isTaskRunCancellation } from '@main/services/task-run'
import { flushPendingAssets } from '../assets'
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

export class PersonUpdateHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly taskRunService: TaskRunService
  ) {}

  startUpdateFromScraper(
    request: PersonUpdateRequest,
    options?: IngestTaskRunOptions
  ): TaskRunStartResult {
    this.validateRequest(request)
    const run = this.taskRunService.runs.create({
      category: 'ingest',
      operation: 'ingest.person.update',
      title: '更新人物元数据',
      description: request.lookup.name,
      owner: { type: 'app' },
      initiator: options?.taskRunInitiator ?? { type: 'user' },
      subject: { type: 'person', id: request.rootId, labelSnapshot: request.lookup.name },
      controls: { cancelable: true, pausable: false },
      presentation: {
        notify: {
          enabled: true,
          title: '更新人物元数据',
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
    this.validateRequest(request)
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'preparing',
      label: '正在准备更新人物元数据'
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
      label: '正在抓取人物元数据'
    })
    const bundle = await this.scraperService.person.scrape(request.profileId, lookup)
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'planning',
      label: '正在生成人物更新计划'
    })
    const incoming = buildPersonIncoming(bundle, lookup)
    const current = loadPersonCurrent(this.dbService.client, request.rootId, selection)
    const plan = buildPersonPlan({
      current,
      incoming,
      selection,
      policy
    })

    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'writing',
      label: '正在写入人物元数据'
    })
    const applyResult = this.dbService.client.transaction((tx) =>
      applyPersonPlan(tx, request.rootId, plan)
    )

    if (applyResult.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: '正在保存人物媒体资源'
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

    return warnings.length > 0 ? { warnings } : {}
  }

  private validateRequest(request: PersonUpdateRequest): void {
    if (!request.rootId) {
      throw new Error('Update rootId is required')
    }
    if (!request.profileId) {
      throw new Error('Update profileId is required')
    }
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
      run.context.throwIfCancelled()
      run.complete({
        title: '人物元数据更新完成',
        summary: '人物元数据已写入资料库。',
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
      if (isTaskRunCancellation(error)) {
        run.cancel({ summary: '更新人物元数据已取消。' })
        return
      }

      run.fail(error)
    }
  }
}
