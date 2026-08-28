import {
  isCancellationError,
  kisaki,
  type ExtensionLogger,
  type TaskRunHandle
} from '@kisaki3/extension-sdk'
import type { GbooksTaskStateView } from '../shared/settings'
import type { GbooksClient } from './api/client'
import { m } from './i18n'
import { runLibraryImport, type ImportOptions, type ImportSummary } from './import/runner'
import { GbooksExtensionError, toSafeErrorLog } from './utils/errors'

const IMPORT_OPERATION = 'googlebooks.library-import'

export interface GbooksTasksDependencies {
  client: GbooksClient
  logger?: ExtensionLogger
}

/**
 * Runs the library import as an app task run; only one may run at a time.
 */
export class GbooksTasks {
  constructor(private readonly deps: GbooksTasksDependencies) {}

  async startImport(options: ImportOptions): Promise<{ runId: string }> {
    const active = await kisaki.taskRuns.listActiveOwn({
      operations: [IMPORT_OPERATION],
      limit: 1
    })
    if (active.length > 0) {
      throw new GbooksExtensionError('operation_running', m().errors.operationRunning)
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
      const summary = await runLibraryImport(
        {
          client: this.deps.client,
          ...(this.deps.logger ? { logger: this.deps.logger } : {})
        },
        options,
        handle
      )

      await handle.complete({
        summary: toImportSummaryText(summary),
        counters: {
          created: summary.created,
          updated: summary.updated,
          unchanged: summary.unchanged,
          skipped: summary.skipped,
          failed: summary.failed,
          mergedAway: summary.mergedAway
        },
        warnings: summary.warnings
      })
    })

    return { runId: handle.id }
  }

  async getTaskState(runId: string): Promise<GbooksTaskStateView | null> {
    const snapshot =
      (await kisaki.taskRuns.getActiveOwn(runId)) ?? (await kisaki.taskRuns.getHistoryOwn(runId))
    if (!snapshot) {
      return null
    }

    const state: GbooksTaskStateView = { runId: snapshot.id, status: snapshot.status }
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

      this.deps.logger?.warn('Google Books library import failed.', toSafeErrorLog(error))
      await handle.fail(error)
    }
  }
}

function toImportSummaryText(summary: ImportSummary): string {
  return m().import.summary({
    created: summary.created,
    updated: summary.updated,
    unchanged: summary.unchanged,
    skipped: summary.skipped,
    failed: summary.failed
  })
}
