import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunHandle, TaskRunService } from '@main/services/task-run'
import { isTaskRunCancellation } from '@main/services/task-run'
import type { IngestPersistHandlers } from '../persist'
import { flushPendingAssets } from '../assets'
import { buildCharacterGraph } from '../graph'
import {
  CHARACTER_UPDATE_CORE_SURFACES,
  CHARACTER_UPDATE_MEDIA_SURFACES,
  CHARACTER_UPDATE_RELATION_SURFACES,
  CHARACTER_UPDATE_SURFACE_KEYS,
  type CharacterUpdateRequest
} from '@shared/ingest/update'
import type { IngestUpdateResult } from '@shared/ingest'
import type { TaskRunStartResult } from '@shared/task-run'
import { applyCharacterPlan } from './apply'
import { loadCharacterCurrent } from './current'
import { buildCharacterIncoming } from './incoming'
import { buildCharacterPlan } from './plan'
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

export class CharacterUpdateHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandlers: IngestPersistHandlers,
    private readonly taskRunService: TaskRunService
  ) {}

  startUpdateFromScraper(
    request: CharacterUpdateRequest,
    options?: IngestTaskRunOptions
  ): TaskRunStartResult {
    this.validateRequest(request)
    const run = this.taskRunService.runs.create({
      category: 'ingest',
      operation: 'ingest.character.update',
      title: '更新角色元数据',
      description: request.lookup.name,
      owner: { type: 'app' },
      initiator: options?.taskRunInitiator ?? { type: 'user' },
      subject: { type: 'character', id: request.rootId, labelSnapshot: request.lookup.name },
      controls: { cancelable: true, pausable: false },
      presentation: {
        notify: {
          enabled: true,
          title: '更新角色元数据',
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
    request: CharacterUpdateRequest,
    options?: IngestTaskRunOptions
  ): Promise<IngestUpdateResult> {
    const start = this.startUpdateFromScraper(request, options)
    return waitForIngestRunOutput<IngestUpdateResult>(this.taskRunService, start.runId)
  }

  async updateFromScraper(
    request: CharacterUpdateRequest,
    options?: IngestOperationOptions
  ): Promise<IngestUpdateResult> {
    this.validateRequest(request)
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'preparing',
      label: '正在准备更新角色元数据'
    })
    const lookup = normalizeLookup(request.lookup)
    const surfaces = normalizeSelection(request.selection.surfaces, CHARACTER_UPDATE_SURFACE_KEYS)
    const selection = resolveUpdateSelection({
      surfaces,
      coreSurfaces: CHARACTER_UPDATE_CORE_SURFACES,
      mediaSurfaces: CHARACTER_UPDATE_MEDIA_SURFACES,
      relationSurfaces: CHARACTER_UPDATE_RELATION_SURFACES
    })
    const policy = normalizePolicy(request.policy)

    reportIngestProgress(options, {
      phase: 'scraping',
      label: '正在抓取角色元数据'
    })
    const bundle = await this.scraperService.character.scrape(request.profileId, lookup)
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'planning',
      label: '正在生成角色更新计划'
    })
    const incoming = buildCharacterIncoming(bundle, lookup)
    const relationGraph =
      selection.relationSurfaces.length > 0 && bundle
        ? buildCharacterGraph(bundle, lookup)
        : undefined
    const current = loadCharacterCurrent(this.dbService.client, request.rootId, selection)
    const plan = buildCharacterPlan({
      current,
      incoming,
      relationGraph,
      selection,
      policy
    })

    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'writing',
      label: '正在写入角色元数据'
    })
    const applyResult = this.dbService.client.transaction((tx) =>
      applyCharacterPlan(tx, request.rootId, plan, this.persistHandlers)
    )

    if (applyResult.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: '正在保存角色媒体资源'
      })
    }
    const warnings = await flushPendingAssets(this.dbService, applyResult.pendingAssets, {
      signal: options?.signal
    })
    if (warnings.length > 0) {
      log.warn('Character update completed with asset warnings.', {
        warningsItemsText: warnings.map((warning) => warning.message).join(' | ')
      })
    }

    return warnings.length > 0 ? { warnings } : {}
  }

  private validateRequest(request: CharacterUpdateRequest): void {
    if (!request.rootId) {
      throw new Error('Update rootId is required')
    }
    if (!request.profileId) {
      throw new Error('Update profileId is required')
    }
  }

  private async handleUpdateFromScraperWithTaskRun(
    run: TaskRunHandle,
    request: CharacterUpdateRequest
  ): Promise<void> {
    try {
      run.start()
      const result = await this.updateFromScraper(request, {
        signal: run.context.signal,
        onProgress: (update) => run.context.report(update)
      })
      run.context.throwIfCancelled()
      run.complete({
        title: '角色元数据更新完成',
        summary: '角色元数据已写入资料库。',
        output: {
          characterId: request.rootId,
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
        run.cancel({ summary: '更新角色元数据已取消。' })
        return
      }

      run.fail(error)
    }
  }
}
