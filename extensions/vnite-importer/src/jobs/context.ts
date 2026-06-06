import type {
  ExtensionLogger,
  ExtensionTaskRunHandle,
  ExtensionTaskRunProgressUpdate,
  ExtensionTaskRunProgressWork,
  ExtensionTaskRunWarning
} from '@kisaki3/extension-sdk'
import type { LibraryGraphResult } from '@kisaki3/extension-api'
import { isExtensionTaskRunCancellation } from '@kisaki3/extension-sdk'
import type { VniteImportDiagnostic } from '../backup/types'
import { VniteImportError, toSafeErrorMessage } from '../shared/errors'
import type { VniteImportExecutorResult } from '../import/executor'
import { createVniteImportJobSummary, type VniteImportJobSummary } from '../import/summary'

export const VNITE_IMPORT_JOB_PHASES = {
  extracting: '正在解压备份包',
  reading: '正在读取 Vnite 数据',
  buildingGraph: '正在构建资料库图',
  attachments: '正在准备媒体文件',
  writing: '正在写入 Kisaki 资料库',
  completion: '正在补全元数据',
  cleanup: '正在清理临时文件',
  finished: '导入完成'
} as const

export type VniteImportJobPhase = keyof typeof VNITE_IMPORT_JOB_PHASES

type JobProgressWorkInput = Partial<
  Pick<ExtensionTaskRunProgressWork, 'current' | 'total' | 'ratePeriod' | 'indeterminate'>
>

export interface VniteImportJobRun {
  fileName: string
  run: ExtensionTaskRunHandle
}

interface VniteImportJobState {
  startedAt: number
  counters: Record<string, number>
  diagnostics: VniteImportDiagnostic[]
}

export class VniteImportJobController {
  constructor(
    private readonly state: VniteImportJobState,
    private readonly run: ExtensionTaskRunHandle
  ) {}

  get signal(): AbortSignal {
    return this.run.signal
  }

  get diagnostics(): readonly VniteImportDiagnostic[] {
    return this.state.diagnostics
  }

  async checkpoint(): Promise<void> {
    await this.run.checkpoint()
  }

  addDiagnostic(diagnostic: VniteImportDiagnostic): void {
    this.state.diagnostics.push(diagnostic)
    if (diagnostic.level === 'warning') {
      this.increment('warnings')
    }
  }

  addDiagnostics(diagnostics: readonly VniteImportDiagnostic[]): void {
    for (const diagnostic of diagnostics) {
      this.addDiagnostic(diagnostic)
    }
  }

  increment(key: string, amount = 1): void {
    this.state.counters[key] = (this.state.counters[key] ?? 0) + amount
  }

  mergeCounters(counters: Record<string, number>): void {
    for (const [key, value] of Object.entries(counters)) {
      this.state.counters[key] = value
    }
  }

  async report(
    phase: VniteImportJobPhase,
    progress: JobProgressWorkInput = {}
  ): Promise<void> {
    const update: ExtensionTaskRunProgressUpdate = {
      phase: {
        key: phase,
        label: VNITE_IMPORT_JOB_PHASES[phase]
      },
      counters: this.state.counters
    }
    const work = createProgressWork(progress)
    if (work) {
      update.work = work
    }

    await this.run.report(update)
  }
}

export async function runVniteImportJob(
  context: VniteImportJobRun,
  logger: ExtensionLogger | undefined,
  execute: (job: VniteImportJobController) => Promise<VniteImportExecutorResult>
): Promise<VniteImportJobSummary> {
  const state: VniteImportJobState = {
    startedAt: Date.now(),
    counters: {},
    diagnostics: []
  }
  const job = new VniteImportJobController(state, context.run)

  try {
    await job.checkpoint()
    const execution = await execute(job)
    job.mergeCounters({ ...execution.summary.counters })
    await job.report('finished', {
      current: execution.summary.counters.gamesTotal,
      total: execution.summary.counters.gamesTotal
    })

    const summary = createVniteImportJobSummary({
      fileName: context.fileName,
      startedAt: state.startedAt,
      graphApply: execution.graph,
      executionSummary: execution.summary,
      diagnostics: state.diagnostics
    })
    await context.run.complete({
      summary: createCompletedMessage(summary),
      output: summary,
      counters: { ...summary.counters },
      warnings: toTaskRunWarnings(summary.diagnostics)
    })
    return summary
  } catch (error) {
    const summary = createFailedJobSummary(context.fileName, state, error)

    if (isVniteImportCancellation(error, context.run.signal)) {
      await job.report('cleanup', { indeterminate: true }).catch(() => undefined)
      await context.run.cancel({
        summary: 'Vnite 导入已取消。',
        output: summary,
        counters: { ...summary.counters },
        warnings: toTaskRunWarnings(summary.diagnostics)
      })
      return summary
    }

    const message = toUserErrorMessage(error)
    await context.run.fail(error, {
      summary: message,
      output: summary,
      counters: { ...summary.counters },
      warnings: toTaskRunWarnings(summary.diagnostics)
    })
    logger?.warn('Vnite import job failed.', toSafeJobErrorLog(error))
    return summary
  }
}

export function toTaskRunWarnings(
  diagnostics: readonly VniteImportDiagnostic[]
): readonly ExtensionTaskRunWarning[] {
  return diagnostics
    .filter((diagnostic) => diagnostic.level === 'warning')
    .map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message
    }))
}

function createProgressWork(
  progress: JobProgressWorkInput
): ExtensionTaskRunProgressWork | undefined {
  const work: ExtensionTaskRunProgressWork = {}
  if (progress.current !== undefined) {
    work.current = progress.current
  }
  if (progress.total !== undefined) {
    work.total = progress.total
  }
  if (progress.current !== undefined || progress.total !== undefined) {
    work.unit = 'item'
  }
  if (progress.ratePeriod !== undefined) {
    work.ratePeriod = progress.ratePeriod
  }
  if (progress.indeterminate !== undefined) {
    work.indeterminate = progress.indeterminate
  }

  return Object.keys(work).length > 0 ? work : undefined
}

function createCompletedMessage(summary: VniteImportJobSummary): string {
  return `Vnite 导入完成：新增 ${summary.counters.gamesCreated} 个游戏，更新 ${summary.counters.gamesUpdated} 个游戏。`
}

function createFailedJobSummary(
  fileName: string,
  state: VniteImportJobState,
  error: unknown
): VniteImportJobSummary {
  const diagnostic = toFailureDiagnostic(error)
  const diagnostics = diagnostic ? [...state.diagnostics, diagnostic] : state.diagnostics

  return {
    fileName,
    startedAt: state.startedAt,
    finishedAt: Date.now(),
    graphApply: createEmptyGraphResult(state.startedAt),
    counters: {
      gamesTotal: state.counters.gamesTotal ?? 0,
      gamesCreated: state.counters.gamesCreated ?? 0,
      gamesUpdated: state.counters.gamesUpdated ?? 0,
      gamesSkipped: state.counters.gamesSkipped ?? 0,
      gamesFailed: state.counters.gamesFailed ?? 0,
      collectionsCreated: state.counters.collectionsCreated ?? 0,
      collectionsUpdated: state.counters.collectionsUpdated ?? 0,
      attachmentsImported: state.counters.attachmentsImported ?? 0,
      attachmentsFailed: state.counters.attachmentsFailed ?? 0,
      completionCompleted: state.counters.completionCompleted ?? 0,
      completionFailed: state.counters.completionFailed ?? 0,
      warnings: diagnostics.filter((item) => item.level === 'warning').length
    },
    diagnostics
  }
}

function createEmptyGraphResult(startedAt: number): LibraryGraphResult {
  return {
    mode: 'apply',
    startedAt,
    finishedAt: Date.now(),
    nodes: [],
    edges: [],
    counters: {},
    diagnostics: []
  }
}

function toFailureDiagnostic(error: unknown): VniteImportDiagnostic | undefined {
  if (isVniteImportCancellation(error)) {
    return undefined
  }

  return {
    level: 'error',
    code: error instanceof VniteImportError ? error.code : 'host_graph_failed',
    message: toUserErrorMessage(error)
  }
}

function isVniteImportCancellation(error: unknown, signal?: AbortSignal): boolean {
  return (
    signal?.aborted ||
    isExtensionTaskRunCancellation(error) ||
    (error instanceof VniteImportError && error.code === 'job_cancelled')
  )
}

function toUserErrorMessage(error: unknown): string {
  if (error instanceof VniteImportError) {
    return error.message
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return 'Vnite 导入失败。'
}

function toSafeJobErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof VniteImportError) {
    return {
      code: error.code,
      message: error.message,
      dbName: error.context?.dbName,
      docId: error.context?.docId,
      attachmentId: error.context?.attachmentId
    }
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    }
  }

  return {
    message: toSafeErrorMessage(error)
  }
}
