import type {
  IngestAddGameDirectOptions,
  IngestAddGameDirectResult,
  IngestAddGameDirectSeed,
  IngestAddGameFromScraperOptions,
  IngestAddGameFromScraperResult
} from '@shared/ingest/add'
import type { ScraperLookup } from '@shared/scraper'
import type { DbService } from '@main/services/db'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunHandle, TaskRunService } from '@main/services/task-run'
import { isTaskRunCancellation } from '@main/services/task-run'
import type { TaskRunStartResult } from '@shared/task-run'
import type { GameIngestPersistHandler } from '../persist'
import { buildDirectGameGraph, buildGameGraph } from '../graph'
import {
  addGameToCollection,
  normalizeIngestLookupInput,
  normalizeLookup,
  requireScrapedBundle
} from './common'
import {
  reportIngestProgress,
  throwIfIngestAborted,
  type IngestOperationOptions,
  type IngestTaskRunOptions
} from '../types'
import { toTaskRunWarnings, waitForIngestRunOutput } from '../task-run'

type GameAddFromScraperOptions = IngestAddGameFromScraperOptions & IngestOperationOptions
type GameAddDirectOptions = IngestAddGameDirectOptions & IngestOperationOptions
type GameAddFromScraperTaskRunOptions = IngestAddGameFromScraperOptions & IngestTaskRunOptions
type GameAddDirectTaskRunOptions = IngestAddGameDirectOptions & IngestTaskRunOptions

export class GameAddHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandler: GameIngestPersistHandler,
    private readonly taskRunService: TaskRunService
  ) {}

  startAddFromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: GameAddFromScraperTaskRunOptions
  ): TaskRunStartResult {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    const run = this.taskRunService.runs.create({
      category: 'ingest',
      operation: 'ingest.game.add',
      title: '添加游戏',
      description: normalized.lookup.name,
      owner: { type: 'app' },
      initiator: options?.taskRunInitiator ?? { type: 'user' },
      subject: { type: 'game', labelSnapshot: normalized.lookup.name },
      controls: { cancelable: true, pausable: false },
      presentation: {
        notify: {
          enabled: true,
          title: '添加游戏',
          showProgress: true,
          showResult: true,
          closable: true
        }
      }
    })

    void this.handleAddFromScraperWithTaskRun(run, normalized.profileId, normalized.lookup, options)
    return { runId: run.id, createdAt: run.createdAt }
  }

  startAddDirect(
    seed: IngestAddGameDirectSeed,
    options?: GameAddDirectTaskRunOptions
  ): TaskRunStartResult {
    const normalizedLookup = normalizeLookup({
      name: seed.name,
      knownIds: seed.knownIds
    })
    const run = this.taskRunService.runs.create({
      category: 'ingest',
      operation: 'ingest.game.add',
      title: '添加游戏',
      description: normalizedLookup.name,
      owner: { type: 'app' },
      initiator: options?.taskRunInitiator ?? { type: 'user' },
      subject: { type: 'game', labelSnapshot: normalizedLookup.name },
      controls: { cancelable: true, pausable: false },
      presentation: {
        notify: {
          enabled: true,
          title: '添加游戏',
          showProgress: true,
          showResult: true,
          closable: true
        }
      }
    })

    void this.handleAddDirectWithTaskRun(run, normalizedLookup, options)
    return { runId: run.id, createdAt: run.createdAt }
  }

  async addFromScraperWithTaskRun(
    profileId: string,
    lookup: ScraperLookup,
    options?: GameAddFromScraperTaskRunOptions
  ): Promise<IngestAddGameFromScraperResult> {
    const start = this.startAddFromScraper(profileId, lookup, options)
    return waitForIngestRunOutput<IngestAddGameFromScraperResult>(this.taskRunService, start.runId)
  }

  async addFromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: GameAddFromScraperOptions
  ): Promise<IngestAddGameFromScraperResult> {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      label: '正在检查现有游戏'
    })
    const existing = this.tryResolveExistingGame(normalized.lookup.knownIds, options)
    if (existing) {
      return existing
    }

    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'scraping',
      label: '正在抓取游戏元数据'
    })
    const bundle = requireScrapedBundle(
      await this.scraperService.game.scrape(normalized.profileId, normalized.lookup),
      'game'
    )
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'building',
      label: '正在整理游戏元数据'
    })
    const graph = buildGameGraph(bundle, normalized.lookup)
    reportIngestProgress(options, {
      phase: 'writing',
      label: '正在写入游戏'
    })
    return this.persistHandler.persistGameGraph(graph, options)
  }

  async addDirectWithTaskRun(
    seed: IngestAddGameDirectSeed,
    options?: GameAddDirectTaskRunOptions
  ): Promise<IngestAddGameDirectResult> {
    const start = this.startAddDirect(seed, options)
    return waitForIngestRunOutput<IngestAddGameDirectResult>(this.taskRunService, start.runId)
  }

  async addDirect(
    seed: IngestAddGameDirectSeed,
    options?: GameAddDirectOptions
  ): Promise<IngestAddGameDirectResult> {
    const normalizedLookup = normalizeLookup({
      name: seed.name,
      knownIds: seed.knownIds
    })
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      label: '正在检查现有游戏',
      phaseCurrent: 1,
      phaseTotal: 2
    })
    const existing = this.tryResolveExistingGame(normalizedLookup.knownIds, options)
    if (existing) {
      return existing
    }

    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'writing',
      label: '正在写入游戏',
      phaseCurrent: 2,
      phaseTotal: 2
    })
    const graph = buildDirectGameGraph(normalizedLookup)
    return this.persistHandler.persistGameGraph(graph, options)
  }

  private async handleAddFromScraperWithTaskRun(
    run: TaskRunHandle,
    profileId: string,
    lookup: ScraperLookup,
    options?: GameAddFromScraperTaskRunOptions
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
      this.completeRun(run, result)
    } catch (error) {
      this.finishRunFromError(run, error)
    }
  }

  private async handleAddDirectWithTaskRun(
    run: TaskRunHandle,
    lookup: ScraperLookup,
    options?: GameAddDirectTaskRunOptions
  ): Promise<void> {
    try {
      run.start()
      const { taskRunInitiator: _taskRunInitiator, ...operationOptions } = options ?? {}
      const result = await this.addDirect(
        { name: lookup.name, knownIds: lookup.knownIds },
        {
          ...operationOptions,
          signal: run.context.signal,
          onProgress: (update) => run.context.report(update)
        }
      )
      run.context.throwIfCancelled()
      this.completeRun(run, result)
    } catch (error) {
      this.finishRunFromError(run, error)
    }
  }

  private completeRun(
    run: TaskRunHandle,
    result: IngestAddGameFromScraperResult | IngestAddGameDirectResult
  ): void {
    const warningItems = toTaskRunWarnings(result.warnings)
    run.complete({
      title: result.isNew ? '游戏添加成功' : '游戏已存在',
      summary: result.isNew ? '游戏已写入资料库。' : '已匹配现有游戏。',
      output: result,
      counters: {
        added: result.isNew ? 1 : 0,
        existing: result.isNew ? 0 : 1,
        warnings: result.warnings?.length ?? 0
      },
      warnings: warningItems
    })
  }

  private finishRunFromError(run: TaskRunHandle, error: unknown): void {
    if (isTaskRunCancellation(error)) {
      run.cancel({ summary: '添加游戏已取消。' })
      return
    }

    run.fail(error)
  }

  private tryResolveExistingGame(
    knownIds: ScraperLookup['knownIds'],
    options?: GameAddDirectOptions | GameAddFromScraperOptions
  ): IngestAddGameDirectResult | undefined {
    if (options?.gameDirPath) {
      const existingByPath = this.dbService.entityFinder.findExistingGame({
        path: options.gameDirPath
      })
      if (existingByPath) {
        addGameToCollection(this.dbService, existingByPath.id, options.targetCollectionId)
        return {
          gameId: existingByPath.id,
          isNew: false,
          existingReason: 'path'
        }
      }
    }

    if (knownIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExistingGame({
        externalIds: knownIds
      })
      if (existingByExternalId) {
        addGameToCollection(this.dbService, existingByExternalId.id, options?.targetCollectionId)
        return {
          gameId: existingByExternalId.id,
          isNew: false,
          existingReason: 'externalId'
        }
      }
    }

    return undefined
  }
}
