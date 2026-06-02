import type {
  IngestAddCompanyFromScraperOptions,
  IngestAddCompanyFromScraperResult
} from '@shared/ingest/add'
import type { ScraperLookup } from '@shared/scraper'
import type { DbService } from '@main/services/db'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunHandle, TaskRunService } from '@main/services/task-run'
import { isTaskRunCancellation } from '@main/services/task-run'
import type { TaskRunStartResult } from '@shared/task-run'
import type { CompanyIngestPersistHandler } from '../persist'
import { buildCompanyGraph } from '../graph'
import { addCompanyToCollection, normalizeIngestLookupInput, requireScrapedBundle } from './common'
import {
  reportIngestProgress,
  throwIfIngestAborted,
  type IngestOperationOptions,
  type IngestTaskRunOptions
} from '../types'
import { toTaskRunWarnings, waitForIngestRunOutput } from '../task-run'

type CompanyAddFromScraperOptions = IngestAddCompanyFromScraperOptions & IngestOperationOptions
type CompanyAddFromScraperTaskRunOptions = IngestAddCompanyFromScraperOptions & IngestTaskRunOptions

export class CompanyAddHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandler: CompanyIngestPersistHandler,
    private readonly taskRunService: TaskRunService
  ) {}

  startAddFromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: CompanyAddFromScraperTaskRunOptions
  ): TaskRunStartResult {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    const run = this.taskRunService.runs.create({
      category: 'ingest',
      operation: 'ingest.company.add',
      title: '添加公司',
      description: normalized.lookup.name,
      owner: { type: 'app' },
      initiator: options?.taskRunInitiator ?? { type: 'user' },
      subject: { type: 'company', labelSnapshot: normalized.lookup.name },
      controls: { cancelable: true, pausable: false },
      presentation: {
        notify: {
          enabled: true,
          title: '添加公司',
          showProgress: true,
          showResult: true,
          closable: true
        }
      }
    })

    void this.handleAddFromScraperWithTaskRun(run, normalized.profileId, normalized.lookup, options)
    return { runId: run.id, createdAt: run.createdAt }
  }

  async addFromScraperWithTaskRun(
    profileId: string,
    lookup: ScraperLookup,
    options?: CompanyAddFromScraperTaskRunOptions
  ): Promise<IngestAddCompanyFromScraperResult> {
    const start = this.startAddFromScraper(profileId, lookup, options)
    return waitForIngestRunOutput<IngestAddCompanyFromScraperResult>(
      this.taskRunService,
      start.runId
    )
  }

  async addFromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: CompanyAddFromScraperOptions
  ): Promise<IngestAddCompanyFromScraperResult> {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      label: '正在检查现有公司'
    })
    if (normalized.lookup.knownIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExistingCompany({
        externalIds: normalized.lookup.knownIds
      })
      if (existingByExternalId) {
        addCompanyToCollection(this.dbService, existingByExternalId.id, options?.targetCollectionId)

        return {
          companyId: existingByExternalId.id,
          isNew: false,
          existingReason: 'externalId'
        }
      }
    }

    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'scraping',
      label: '正在抓取公司元数据'
    })
    const bundle = requireScrapedBundle(
      await this.scraperService.company.scrape(normalized.profileId, normalized.lookup),
      'company'
    )
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'building',
      label: '正在整理公司元数据'
    })
    const graph = buildCompanyGraph(bundle, normalized.lookup)
    reportIngestProgress(options, {
      phase: 'writing',
      label: '正在写入公司'
    })
    return this.persistHandler.persistCompanyGraph(graph, options)
  }

  private async handleAddFromScraperWithTaskRun(
    run: TaskRunHandle,
    profileId: string,
    lookup: ScraperLookup,
    options?: CompanyAddFromScraperTaskRunOptions
  ): Promise<void> {
    try {
      run.start()
      const { taskRunInitiator: _taskRunInitiator, ...operationOptions } = options ?? {}
      const result = await this.addFromScraper(profileId, lookup, {
        ...operationOptions,
        signal: run.context.signal,
        onProgress: (update) => run.context.report(update)
      })
      run.context.throwIfCancelled()
      const warningItems = toTaskRunWarnings(result.warnings)
      run.complete({
        title: result.isNew ? '公司添加成功' : '公司已存在',
        summary: result.isNew ? '公司已写入资料库。' : '已匹配现有公司。',
        output: result,
        counters: {
          added: result.isNew ? 1 : 0,
          existing: result.isNew ? 0 : 1,
          warnings: result.warnings?.length ?? 0
        },
        warnings: warningItems
      })
    } catch (error) {
      if (isTaskRunCancellation(error)) {
        run.cancel({ summary: '添加公司已取消。' })
        return
      }

      run.fail(error)
    }
  }
}
