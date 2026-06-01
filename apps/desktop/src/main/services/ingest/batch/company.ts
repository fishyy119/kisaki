import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunHandle, TaskRunService } from '@main/services/task-run'
import { isTaskRunCancellation } from '@main/services/task-run'
import { buildIngestUpdateLookup, type CompanyBatchUpdateRequest } from '@shared/ingest/update'
import type { TaskRunStartResult } from '@shared/task-run'
import { companies, companyExternalIds } from '@shared/db'
import { inArray } from 'drizzle-orm'
import type { CompanyUpdateHandler } from '../update'
import { throwIfIngestAborted } from '../types'
import {
  createBatchTaskRunWarnings,
  getBatchRowQueryName,
  getSafeBatchError,
  pushBoundedFailure,
  pushBoundedItemWarning,
  reportBatchProgress,
  type IngestBatchCounters,
  type IngestBatchFailure,
  type IngestBatchItemWarning,
  type IngestBatchResult,
  type IngestBatchUpdateRow
} from './types'

const log = createLogger('Ingest')

export class CompanyBatchHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly updateHandler: CompanyUpdateHandler,
    private readonly taskRunService: TaskRunService
  ) {}

  startUpdateFromScraper(request: CompanyBatchUpdateRequest): TaskRunStartResult {
    this.validateRequest(request)
    const run = this.taskRunService.runs.create({
      category: 'ingest',
      operation: 'ingest.company.batchUpdate',
      title: '批量更新公司元数据',
      description: `${request.rootIds.length} 个公司`,
      owner: { type: 'app' },
      initiator: { type: 'user' },
      subject: { type: 'company', labelSnapshot: `${request.rootIds.length} 个公司` },
      controls: { cancelable: true, pausable: false },
      presentation: {
        notify: {
          enabled: true,
          title: '批量更新公司元数据',
          showProgress: true,
          showResult: true,
          closable: true
        }
      }
    })

    void this.executeUpdateRun(run, request)
    return { runId: run.id, createdAt: run.createdAt }
  }

  private async executeUpdateRun(
    run: TaskRunHandle,
    request: CompanyBatchUpdateRequest
  ): Promise<void> {
    const counters: IngestBatchCounters = { succeeded: 0, failed: 0, skipped: 0, warnings: 0 }
    const failures: IngestBatchFailure[] = []
    const itemWarnings: IngestBatchItemWarning[] = []
    const total = request.rootIds.length

    try {
      run.start()
      run.context.report({
        phase: 'searching',
        message: '正在准备公司列表',
        current: 0,
        total,
        unit: 'entity',
        counters: { ...counters },
        warnings: []
      })

      const rows = this.loadRows(request.rootIds)
      counters.skipped = Math.max(0, total - rows.length)
      let processed = counters.skipped

      for (const row of rows) {
        await run.context.checkpoint()
        const queryName = getBatchRowQueryName(row)
        const baseKnownIds = request.useCurrentExternalIdsAsKnownIds ? row.externalIds : []

        reportBatchProgress({
          context: run.context,
          phase: 'searching',
          message: queryName,
          current: processed,
          total,
          counters,
          failures,
          itemWarnings
        })

        try {
          throwIfIngestAborted(run.context.signal)
          const searchResults = await this.scraperService.company.search(
            request.profileId,
            queryName
          )
          throwIfIngestAborted(run.context.signal)
          const first = searchResults[0]
          if (!first) {
            throw new Error('无搜索结果')
          }

          reportBatchProgress({
            context: run.context,
            phase: 'updating',
            message: queryName,
            current: processed,
            total,
            counters,
            failures,
            itemWarnings
          })

          const result = await this.updateHandler.updateFromScraper(
            {
              rootId: row.id,
              profileId: request.profileId,
              lookup: buildIngestUpdateLookup({
                name: first.originalName || first.name || queryName,
                baseKnownIds,
                selectionKnownIds: first.externalIds
              }),
              selection: { surfaces: [...request.selection.surfaces] },
              policy: request.policy
            },
            { signal: run.context.signal }
          )

          counters.succeeded++
          counters.warnings += result.warnings?.length ?? 0
          for (const warning of result.warnings ?? []) {
            pushBoundedItemWarning(itemWarnings, {
              entityId: row.id,
              name: queryName,
              code: warning.code,
              message: warning.message
            })
          }
        } catch (error) {
          if (isTaskRunCancellation(error)) {
            throw error
          }

          counters.failed++
          const message = getSafeBatchError(error)
          pushBoundedFailure(failures, { entityId: row.id, name: queryName, error: message })
          log.warn('Batch company metadata update item failed.', {
            companyId: row.id,
            companyName: queryName,
            message
          })
        }

        processed++
        reportBatchProgress({
          context: run.context,
          phase: 'updating',
          current: processed,
          total,
          counters,
          failures,
          itemWarnings
        })
      }

      run.complete({
        title: counters.failed > 0 ? '批量更新公司元数据完成（有失败）' : '批量更新公司元数据完成',
        summary: `成功 ${counters.succeeded}，失败 ${counters.failed}，跳过 ${counters.skipped}`,
        counters,
        warnings: createBatchTaskRunWarnings(failures, itemWarnings),
        output: this.createResult(total, counters, failures, itemWarnings)
      })
    } catch (error) {
      if (isTaskRunCancellation(error)) {
        run.cancel({
          summary: `已取消。成功 ${counters.succeeded}，失败 ${counters.failed}，跳过 ${counters.skipped}`,
          counters,
          warnings: createBatchTaskRunWarnings(failures, itemWarnings),
          output: this.createResult(total, counters, failures, itemWarnings)
        })
        return
      }

      run.fail(error, {
        counters,
        warnings: createBatchTaskRunWarnings(failures, itemWarnings),
        output: this.createResult(total, counters, failures, itemWarnings)
      })
    }
  }

  private loadRows(ids: string[]): IngestBatchUpdateRow[] {
    const rows = this.dbService.client
      .select({ id: companies.id, name: companies.name, originalName: companies.originalName })
      .from(companies)
      .where(inArray(companies.id, ids))
      .all()

    const extRows = this.dbService.client
      .select({
        companyId: companyExternalIds.companyId,
        source: companyExternalIds.source,
        id: companyExternalIds.externalId
      })
      .from(companyExternalIds)
      .where(inArray(companyExternalIds.companyId, ids))
      .all()

    const externalIdsById = new Map<string, IngestBatchUpdateRow['externalIds']>()
    for (const row of extRows) {
      const list = externalIdsById.get(row.companyId) ?? []
      list.push({ source: row.source, id: row.id })
      externalIdsById.set(row.companyId, list)
    }

    const rowById = new Map(rows.map((row) => [row.id, row] as const))
    return ids.flatMap((id) => {
      const row = rowById.get(id)
      return row
        ? [
            {
              id: row.id,
              name: row.name,
              originalName: row.originalName ?? null,
              externalIds: externalIdsById.get(row.id) ?? []
            }
          ]
        : []
    })
  }

  private validateRequest(request: CompanyBatchUpdateRequest): void {
    if (request.rootIds.length === 0) {
      throw new Error('Batch update rootIds are required.')
    }
    if (!request.profileId) {
      throw new Error('Batch update profileId is required.')
    }
    if (request.selection.surfaces.length === 0) {
      throw new Error('Batch update selection is required.')
    }
  }

  private createResult(
    total: number,
    counters: IngestBatchCounters,
    failures: IngestBatchFailure[],
    itemWarnings: IngestBatchItemWarning[]
  ): IngestBatchResult {
    return {
      total,
      succeeded: counters.succeeded,
      failed: counters.failed,
      skipped: counters.skipped,
      failures,
      warnings: itemWarnings
    }
  }
}
