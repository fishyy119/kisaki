import type {
  IngestAddPersonFromScraperOptions,
  IngestAddPersonFromScraperResult
} from '@shared/ingest/add'
import type { ScraperLookup } from '@shared/scraper'
import type { DbService } from '@main/services/db'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunHandle, TaskRunService } from '@main/services/task-run'
import { isTaskRunCancellation } from '@main/services/task-run'
import type { TaskRunStartResult } from '@shared/task-run'
import type { PersonIngestPersistHandler } from '../persist'
import { buildPersonGraph } from '../graph'
import { addPersonToCollection, normalizeIngestLookupInput, requireScrapedBundle } from './common'
import {
  reportIngestProgress,
  throwIfIngestAborted,
  type IngestOperationOptions,
  type IngestTaskRunOptions
} from '../types'
import { toTaskRunWarnings, waitForIngestRunOutput } from '../task-run'

type PersonAddFromScraperOptions = IngestAddPersonFromScraperOptions & IngestOperationOptions
type PersonAddFromScraperTaskRunOptions = IngestAddPersonFromScraperOptions & IngestTaskRunOptions

export class PersonAddHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandler: PersonIngestPersistHandler,
    private readonly taskRunService: TaskRunService
  ) {}

  startAddFromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: PersonAddFromScraperTaskRunOptions
  ): TaskRunStartResult {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    const run = this.taskRunService.runs.create({
      category: 'ingest',
      operation: 'ingest.person.add',
      title: '添加人物',
      description: normalized.lookup.name,
      owner: { type: 'app' },
      initiator: options?.taskRunInitiator ?? { type: 'user' },
      subject: { type: 'person', labelSnapshot: normalized.lookup.name },
      controls: { cancelable: true, pausable: false },
      presentation: {
        notify: {
          enabled: true,
          title: '添加人物',
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
    options?: PersonAddFromScraperTaskRunOptions
  ): Promise<IngestAddPersonFromScraperResult> {
    const start = this.startAddFromScraper(profileId, lookup, options)
    return waitForIngestRunOutput<IngestAddPersonFromScraperResult>(
      this.taskRunService,
      start.runId
    )
  }

  async addFromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: PersonAddFromScraperOptions
  ): Promise<IngestAddPersonFromScraperResult> {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      message: '正在检查现有人物'
    })
    if (normalized.lookup.knownIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExistingPerson({
        externalIds: normalized.lookup.knownIds
      })
      if (existingByExternalId) {
        addPersonToCollection(this.dbService, existingByExternalId.id, options?.targetCollectionId)

        return {
          personId: existingByExternalId.id,
          isNew: false,
          existingReason: 'externalId'
        }
      }
    }

    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'scraping',
      message: '正在抓取人物元数据'
    })
    const bundle = requireScrapedBundle(
      await this.scraperService.person.scrape(normalized.profileId, normalized.lookup),
      'person'
    )
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'building',
      message: '正在整理人物元数据'
    })
    const graph = buildPersonGraph(bundle, normalized.lookup)
    reportIngestProgress(options, {
      phase: 'writing',
      message: '正在写入人物'
    })
    return this.persistHandler.persistPersonGraph(graph, options)
  }

  private async handleAddFromScraperWithTaskRun(
    run: TaskRunHandle,
    profileId: string,
    lookup: ScraperLookup,
    options?: PersonAddFromScraperTaskRunOptions
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
        title: result.isNew ? '人物添加成功' : '人物已存在',
        summary: result.isNew ? '人物已写入资料库。' : '已匹配现有人物。',
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
        run.cancel({ summary: '添加人物已取消。' })
        return
      }

      run.fail(error)
    }
  }
}
