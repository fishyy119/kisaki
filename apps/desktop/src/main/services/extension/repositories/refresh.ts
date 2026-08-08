import { isAbortError } from '@main/utils/async'
import {
  isTaskRunCancellation,
  type TaskRunHandle,
  type TaskRunService
} from '@main/services/task-run'
import type { I18nService } from '@main/services/i18n'
import type { Messages } from '@shared/i18n'
import type { ExtensionRepositoryRow } from '@shared/db'
import type { ExtensionRepositoryRefreshResult } from '@shared/extension'
import type {
  TaskRunInitiator,
  TaskRunProgressUpdate,
  TaskRunStartResult,
  TaskRunWarning
} from '@shared/task-run'
import type { ExtensionRepositoryStore } from './store'
import { requireNonEmptyString } from './normalization'

const MAX_REPOSITORY_REFRESH_OUTPUT_RESULTS = 50
const MAX_REPOSITORY_REFRESH_WARNINGS = 20

export interface ExtensionRepositoryRefreshOptions {
  signal?: AbortSignal
}

export interface ExtensionRepositoryRefreshRunnerOptions {
  taskRun: TaskRunService
  store: ExtensionRepositoryStore
  i18n: I18nService
  refreshRepository(
    repositoryId: string,
    options?: ExtensionRepositoryRefreshOptions
  ): Promise<ExtensionRepositoryRefreshResult>
}

interface StartedRepositoryRefreshRun<T> {
  start: TaskRunStartResult
  completed: Promise<T>
}

interface RepositoryRefreshCounters extends Record<string, number> {
  total: number
  processed: number
  succeeded: number
  notModified: number
  failed: number
  changed: number
}

export class ExtensionRepositoryRefreshRunner {
  constructor(private readonly options: ExtensionRepositoryRefreshRunnerOptions) {}

  private get messages(): Messages {
    return this.options.i18n.messages
  }

  startRefreshRepository(repositoryId: string): TaskRunStartResult {
    const run = this.createRefreshRepositoryRun(repositoryId, { type: 'user' })
    void run.completed.catch(() => undefined)
    return run.start
  }

  startRefreshRepositories(): TaskRunStartResult {
    const run = this.createRefreshRepositoriesRun({ type: 'user' })
    void run.completed.catch(() => undefined)
    return run.start
  }

  runRefreshRepositories(
    initiator: TaskRunInitiator
  ): Promise<readonly ExtensionRepositoryRefreshResult[]> {
    return this.createRefreshRepositoriesRun(initiator).completed
  }

  private createRefreshRepositoryRun(
    repositoryId: string,
    initiator: TaskRunInitiator
  ): StartedRepositoryRefreshRun<ExtensionRepositoryRefreshResult> {
    const row = this.options.store.require(requireNonEmptyString(repositoryId, 'repository id'))
    const run = this.options.taskRun.runs.create({
      category: 'extension',
      operation: 'extension.repository.refresh',
      title: this.messages.extension.repositoryRefresh.refreshOneTitle({ name: row.name }),
      owner: { type: 'app' },
      initiator,
      subject: {
        type: 'repository',
        id: row.id,
        labelSnapshot: row.name
      },
      controls: { cancelable: true, pausable: false }
    })

    return {
      start: { runId: run.id, createdAt: run.createdAt },
      completed: this.executeRefreshRepositoryRun(run, row)
    }
  }

  private createRefreshRepositoriesRun(
    initiator: TaskRunInitiator
  ): StartedRepositoryRefreshRun<readonly ExtensionRepositoryRefreshResult[]> {
    const run = this.options.taskRun.runs.create({
      category: 'extension',
      operation: 'extension.repository.refreshAll',
      title: this.messages.extension.repositoryRefresh.refreshAllTitle,
      owner: { type: 'app' },
      initiator,
      subject: {
        type: 'repository',
        labelSnapshot: this.messages.extension.repositoryRefresh.allSubjectLabel
      },
      controls: { cancelable: true, pausable: false }
    })

    return {
      start: { runId: run.id, createdAt: run.createdAt },
      completed: this.executeRefreshRepositoriesRun(run)
    }
  }

  private async executeRefreshRepositoryRun(
    run: TaskRunHandle,
    row: ExtensionRepositoryRow
  ): Promise<ExtensionRepositoryRefreshResult> {
    try {
      run.start()
      run.context.report(createSingleRepositoryRefreshProgress(this.messages, row.name))

      const result = await this.options.refreshRepository(row.id, {
        signal: run.context.signal
      })
      run.context.throwIfCancelled()
      this.finishSingleRepositoryRefreshRun(run, result)
      return result
    } catch (error) {
      finishTaskRunFromError(run, error, {
        cancelledSummary: this.messages.extension.repositoryRefresh.cancelledSummary
      })
      throw error
    }
  }

  private async executeRefreshRepositoriesRun(
    run: TaskRunHandle
  ): Promise<readonly ExtensionRepositoryRefreshResult[]> {
    const rows = this.options.store.listEnabled()
    const results: ExtensionRepositoryRefreshResult[] = []

    try {
      run.start()
      run.context.report(
        createRepositoryRefreshAllProgress({
          current: 0,
          total: rows.length,
          label:
            rows.length > 0
              ? this.messages.extension.repositoryRefresh.preparing
              : this.messages.extension.repositoryRefresh.noneEnabled,
          results
        })
      )

      for (const [index, row] of rows.entries()) {
        await run.context.checkpoint()
        run.context.report(
          createRepositoryRefreshAllProgress({
            current: index,
            total: rows.length,
            label: this.messages.extension.repositoryRefresh.refreshingOne({ name: row.name }),
            results
          })
        )

        const result = await this.options.refreshRepository(row.id, {
          signal: run.context.signal
        })
        run.context.throwIfCancelled()
        results.push(result)

        run.context.report(
          createRepositoryRefreshAllProgress({
            current: index + 1,
            total: rows.length,
            label: this.messages.extension.repositoryRefresh.refreshedOne({ name: row.name }),
            results
          })
        )
      }

      this.finishRepositoryRefreshAllRun(run, results)
      return results
    } catch (error) {
      finishTaskRunFromError(run, error, {
        cancelledSummary: this.messages.extension.repositoryRefresh.cancelledSummary
      })
      throw error
    }
  }

  private finishSingleRepositoryRefreshRun(
    run: TaskRunHandle,
    result: ExtensionRepositoryRefreshResult
  ): void {
    const counters = createRepositoryRefreshCounters([result])
    const warnings = createRepositoryRefreshWarnings([result])
    const output = createRepositoryRefreshOutput([result])

    if (result.status === 'failed') {
      run.fail(new Error(result.error ?? 'Extension repository refresh failed.'), {
        title: this.messages.extension.repositoryRefresh.oneFailedTitle,
        summary: this.messages.extension.repositoryRefresh.oneFailedSummary({
          name: result.repository.name
        }),
        counters,
        warnings,
        output
      })
      return
    }

    run.complete({
      title:
        result.status === 'not-modified'
          ? this.messages.extension.repositoryRefresh.oneNotModifiedTitle
          : this.messages.extension.repositoryRefresh.oneCompletedTitle,
      summary:
        result.status === 'not-modified'
          ? this.messages.extension.repositoryRefresh.oneNotModifiedSummary({
              name: result.repository.name
            })
          : this.messages.extension.repositoryRefresh.oneRefreshedSummary({
              name: result.repository.name
            }),
      counters,
      output
    })
  }

  private finishRepositoryRefreshAllRun(
    run: TaskRunHandle,
    results: readonly ExtensionRepositoryRefreshResult[]
  ): void {
    const counters = createRepositoryRefreshCounters(results)
    const warnings = createRepositoryRefreshWarnings(results)
    const output = createRepositoryRefreshOutput(results)
    const summary = createRepositoryRefreshSummary(this.messages, counters)

    if (counters.total > 0 && counters.failed === counters.total) {
      run.fail(new Error('All extension repositories failed to refresh.'), {
        title: this.messages.extension.repositoryRefresh.allFailedTitle,
        summary,
        counters,
        warnings,
        output
      })
      return
    }

    run.complete({
      title:
        counters.failed > 0
          ? this.messages.extension.repositoryRefresh.allPartialTitle
          : this.messages.extension.repositoryRefresh.allCompletedTitle,
      summary,
      counters,
      warnings,
      output
    })
  }
}

function createSingleRepositoryRefreshProgress(
  messages: Messages,
  repositoryName: string
): TaskRunProgressUpdate {
  return {
    phase: {
      key: 'refresh',
      label: messages.extension.repositoryRefresh.refreshingOne({ name: repositoryName }),
      current: 1,
      total: 1
    },
    work: {
      indeterminate: true,
      unit: 'request'
    }
  }
}

function createRepositoryRefreshAllProgress(input: {
  current: number
  total: number
  label: string
  results: readonly ExtensionRepositoryRefreshResult[]
}): TaskRunProgressUpdate {
  const phase =
    input.total > 0
      ? {
          key: 'refresh',
          label: input.label,
          current: Math.min(input.total, input.current + 1),
          total: input.total
        }
      : {
          key: 'refresh',
          label: input.label
        }

  return {
    phase,
    work: {
      current: input.current,
      total: input.total,
      unit: 'item'
    },
    counters: createRepositoryRefreshCounters(input.results, input.total),
    warnings: createRepositoryRefreshWarnings(input.results)
  }
}

function createRepositoryRefreshCounters(
  results: readonly ExtensionRepositoryRefreshResult[],
  total = results.length
): RepositoryRefreshCounters {
  const succeeded = results.filter((result) => result.status === 'success').length
  const notModified = results.filter((result) => result.status === 'not-modified').length
  const failed = results.filter((result) => result.status === 'failed').length
  const changed = results.filter((result) => result.changed).length

  return {
    total,
    processed: results.length,
    succeeded,
    notModified,
    failed,
    changed
  }
}

function createRepositoryRefreshWarnings(
  results: readonly ExtensionRepositoryRefreshResult[]
): readonly TaskRunWarning[] {
  return results
    .filter((result) => result.status === 'failed')
    .slice(0, MAX_REPOSITORY_REFRESH_WARNINGS)
    .map((result) => ({
      code: 'repository.refresh.failed',
      message: `${result.repository.name}: ${result.error ?? 'Unknown refresh error'}`
    }))
}

function createRepositoryRefreshOutput(results: readonly ExtensionRepositoryRefreshResult[]) {
  const visibleResults = results.slice(0, MAX_REPOSITORY_REFRESH_OUTPUT_RESULTS)
  return {
    total: results.length,
    truncated: results.length > visibleResults.length,
    repositories: visibleResults.map((result) => ({
      id: result.repository.id,
      name: result.repository.name,
      status: result.status,
      changed: result.changed,
      error: result.error
    }))
  }
}

function createRepositoryRefreshSummary(
  messages: Messages,
  counters: RepositoryRefreshCounters
): string {
  if (counters.total === 0) {
    return messages.extension.repositoryRefresh.noneEnabledSummary
  }

  return messages.extension.repositoryRefresh.allSummary({
    processed: counters.processed,
    total: counters.total,
    succeeded: counters.succeeded,
    notModified: counters.notModified,
    failed: counters.failed
  })
}

function finishTaskRunFromError(
  run: TaskRunHandle,
  error: unknown,
  options: { cancelledSummary: string }
): void {
  if (isTaskRunCancellation(error) || run.context.signal.aborted || isAbortError(error)) {
    run.cancel({ summary: options.cancelledSummary })
    return
  }

  run.fail(error)
}
