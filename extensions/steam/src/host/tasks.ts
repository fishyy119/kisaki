import {
  isCancellationError,
  kisaki,
  type ExtensionLogger,
  type TaskRunHandle
} from '@kisaki3/extension-sdk'
import type { SteamTaskStateView } from '../shared/settings'
import type { SteamClient } from './api/client'
import { m } from './i18n'
import { runOwnedGamesImport, type ImportOptions, type ImportSummary } from './import/runner'
import { SteamExtensionError, toSafeErrorLog } from './utils/errors'

const IMPORT_OPERATION = 'steam.owned-import'

export interface SteamTasksDependencies {
  client: SteamClient
  logger?: ExtensionLogger
}

/**
 * Runs the owned-games import as an app task run; only one may run at a time.
 */
export class SteamTasks {
  constructor(private readonly deps: SteamTasksDependencies) {}

  async startImport(options: ImportOptions): Promise<{ runId: string }> {
    const active = await kisaki.taskRuns.listActiveOwn({
      operations: [IMPORT_OPERATION],
      limit: 1
    })
    if (active.length > 0) {
      throw new SteamExtensionError('operation_running', m().errors.operationRunning)
    }

    const handle = await kisaki.taskRuns.create({
      operation: IMPORT_OPERATION,
      title: m().import.taskTitle,
      controls: { cancelable: true },
      presentation: {
        notify: { enabled: true, showProgress: true, showResult: true }
      }
    })

    void this.runGuarded(handle, async () => {
      const summary = await runOwnedGamesImport(
        {
          client: this.deps.client,
          ...(this.deps.logger ? { logger: this.deps.logger } : {})
        },
        options,
        handle
      )

      await handle.complete({
        summary: toSummaryText(summary),
        counters: {
          created: summary.created,
          existing: summary.existing,
          failed: summary.failed
        },
        warnings: summary.warnings
      })
    })

    return { runId: handle.id }
  }

  async getTaskState(runId: string): Promise<SteamTaskStateView | null> {
    const snapshot =
      (await kisaki.taskRuns.getActiveOwn(runId)) ?? (await kisaki.taskRuns.getHistoryOwn(runId))
    if (!snapshot) {
      return null
    }

    const state: SteamTaskStateView = { runId: snapshot.id, status: snapshot.status }
    if (snapshot.progress?.work?.current !== undefined) {
      state.current = snapshot.progress.work.current
    }
    if (snapshot.progress?.work?.total !== undefined) {
      state.total = snapshot.progress.work.total
    }
    const counters = snapshot.progress?.counters ?? snapshot.result?.counters
    if (counters) {
      state.counters = { ...counters }
    }
    if (snapshot.result?.summary !== undefined) {
      state.summary = snapshot.result.summary
    }
    if (snapshot.result?.error !== undefined) {
      state.error = snapshot.result.error
    }
    return state
  }

  async cancelTask(runId: string): Promise<boolean> {
    return kisaki.taskRuns.cancelOwn(runId)
  }

  private async runGuarded(handle: TaskRunHandle, work: () => Promise<void>): Promise<void> {
    try {
      await work()
    } catch (error) {
      if (isCancellationError(error)) {
        await handle.cancel()
        return
      }

      this.deps.logger?.warn('Steam owned-games import failed.', toSafeErrorLog(error))
      await handle.fail(error)
    }
  }
}

function toSummaryText(summary: ImportSummary): string {
  return m().import.summary({
    created: summary.created,
    existing: summary.existing,
    failed: summary.failed
  })
}
