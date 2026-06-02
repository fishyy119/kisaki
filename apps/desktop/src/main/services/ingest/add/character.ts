import type {
  IngestAddCharacterFromScraperOptions,
  IngestAddCharacterFromScraperResult
} from '@shared/ingest/add'
import type { ScraperLookup } from '@shared/scraper'
import type { DbService } from '@main/services/db'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunHandle, TaskRunService } from '@main/services/task-run'
import { isTaskRunCancellation } from '@main/services/task-run'
import type { TaskRunStartResult } from '@shared/task-run'
import type { CharacterIngestPersistHandler } from '../persist'
import { buildCharacterGraph } from '../graph'
import {
  addCharacterToCollection,
  normalizeIngestLookupInput,
  requireScrapedBundle
} from './common'
import {
  reportIngestProgress,
  throwIfIngestAborted,
  type IngestOperationOptions,
  type IngestTaskRunOptions
} from '../types'
import { toTaskRunWarnings, waitForIngestRunOutput } from '../task-run'

type CharacterAddFromScraperOptions = IngestAddCharacterFromScraperOptions & IngestOperationOptions
type CharacterAddFromScraperTaskRunOptions = IngestAddCharacterFromScraperOptions &
  IngestTaskRunOptions

export class CharacterAddHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandler: CharacterIngestPersistHandler,
    private readonly taskRunService: TaskRunService
  ) {}

  startAddFromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: CharacterAddFromScraperTaskRunOptions
  ): TaskRunStartResult {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    const run = this.taskRunService.runs.create({
      category: 'ingest',
      operation: 'ingest.character.add',
      title: '添加角色',
      description: normalized.lookup.name,
      owner: { type: 'app' },
      initiator: options?.taskRunInitiator ?? { type: 'user' },
      subject: { type: 'character', labelSnapshot: normalized.lookup.name },
      controls: { cancelable: true, pausable: false },
      presentation: {
        notify: {
          enabled: true,
          title: '添加角色',
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
    options?: CharacterAddFromScraperTaskRunOptions
  ): Promise<IngestAddCharacterFromScraperResult> {
    const start = this.startAddFromScraper(profileId, lookup, options)
    return waitForIngestRunOutput<IngestAddCharacterFromScraperResult>(
      this.taskRunService,
      start.runId
    )
  }

  async addFromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: CharacterAddFromScraperOptions
  ): Promise<IngestAddCharacterFromScraperResult> {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      label: '正在检查现有角色'
    })
    if (normalized.lookup.knownIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExistingCharacter({
        externalIds: normalized.lookup.knownIds
      })
      if (existingByExternalId) {
        addCharacterToCollection(
          this.dbService,
          existingByExternalId.id,
          options?.targetCollectionId
        )

        return {
          characterId: existingByExternalId.id,
          isNew: false,
          existingReason: 'externalId'
        }
      }
    }

    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'scraping',
      label: '正在抓取角色元数据'
    })
    const bundle = requireScrapedBundle(
      await this.scraperService.character.scrape(normalized.profileId, normalized.lookup),
      'character'
    )
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'building',
      label: '正在整理角色元数据'
    })
    const graph = buildCharacterGraph(bundle, normalized.lookup)
    reportIngestProgress(options, {
      phase: 'writing',
      label: '正在写入角色'
    })
    return this.persistHandler.persistCharacterGraph(graph, options)
  }

  private async handleAddFromScraperWithTaskRun(
    run: TaskRunHandle,
    profileId: string,
    lookup: ScraperLookup,
    options?: CharacterAddFromScraperTaskRunOptions
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
        title: result.isNew ? '角色添加成功' : '角色已存在',
        summary: result.isNew ? '角色已写入资料库。' : '已匹配现有角色。',
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
        run.cancel({ summary: '添加角色已取消。' })
        return
      }

      run.fail(error)
    }
  }
}
