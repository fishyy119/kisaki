import {
  isCancellationError,
  kisaki,
  type ExtensionLogger,
  type TaskRunHandle
} from '@kisaki3/extension-sdk'
import type { NeodbTaskStateView } from '../shared/settings'
import type { NeodbClient } from './api/client'
import { m } from './i18n'
import { runShelfImport, type ImportOptions, type ImportSummary } from './import/runner'
import { listAllNovels, readNeodbId } from './library'
import type { SyncEngine } from './sync/engine'
import type { SyncSuppressor } from './sync/suppressor'
import { NeodbExtensionError, toSafeErrorLog } from './utils/errors'

const IMPORT_OPERATION = 'neodb.shelf-import'
const PUSH_OPERATION = 'neodb.shelf-push'
const OPERATIONS = [IMPORT_OPERATION, PUSH_OPERATION]

export interface NeodbTasksDependencies {
  client: NeodbClient
  engine: SyncEngine
  suppressor: SyncSuppressor
  logger?: ExtensionLogger
}

/**
 * Runs shelf import and full push as app task runs.
 *
 * Both operations walk whole shelves, so only one may run at a time; the
 * task-run surface supplies progress, cancellation, and history for free.
 */
export class NeodbTasks {
  constructor(private readonly deps: NeodbTasksDependencies) {}

  async startImport(options: ImportOptions): Promise<{ runId: string }> {
    await this.requireIdle()

    const handle = await kisaki.taskRuns.create({
      operation: IMPORT_OPERATION,
      title: m().import.taskTitle,
      controls: { cancelable: true },
      presentation: {
        notify: { enabled: true, showProgress: true, showResult: true }
      }
    })

    void this.runGuarded(handle, 'NeoDB shelf import failed.', async () => {
      const summary = await runShelfImport(
        {
          client: this.deps.client,
          suppressor: this.deps.suppressor,
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
          failed: summary.failed
        },
        warnings: summary.warnings
      })
    })

    return { runId: handle.id }
  }

  async startPushAll(): Promise<{ runId: string }> {
    await this.requireIdle()

    const handle = await kisaki.taskRuns.create({
      operation: PUSH_OPERATION,
      title: m().sync.pushTaskTitle,
      controls: { cancelable: true },
      presentation: {
        notify: { enabled: true, showProgress: true, showResult: true }
      }
    })

    void this.runGuarded(handle, 'NeoDB full push failed.', async () => {
      const novelIds: string[] = []
      for (const entry of await listAllNovels()) {
        if (readNeodbId(entry.externalIds ?? []) !== null) {
          novelIds.push(entry.id)
        }
      }

      let pushed = 0
      let skipped = 0
      let failed = 0

      for (const [index, novelId] of novelIds.entries()) {
        handle.signal.throwIfAborted()

        try {
          const result = await this.deps.engine.syncItem(novelId, {
            signal: handle.signal,
            force: true
          })
          if (result.status === 'synced') {
            pushed += 1
          } else {
            skipped += 1
          }
        } catch (error) {
          if (isCancellationError(error)) {
            throw error
          }
          failed += 1
          this.deps.logger?.warn('NeoDB push failed for one entry.', {
            novelId,
            ...toSafeErrorLog(error)
          })
        }

        if ((index + 1) % 5 === 0 || index + 1 === novelIds.length) {
          await handle.report({
            work: { current: index + 1, total: novelIds.length, unit: 'entity' },
            counters: { pushed, skipped, failed }
          })
        }
      }

      await handle.complete({
        summary: m().sync.pushSummary({ pushed, skipped, failed }),
        counters: { pushed, skipped, failed }
      })
    })

    return { runId: handle.id }
  }

  async getTaskState(runId: string): Promise<NeodbTaskStateView | null> {
    const snapshot =
      (await kisaki.taskRuns.getActiveOwn(runId)) ?? (await kisaki.taskRuns.getHistoryOwn(runId))
    if (!snapshot) {
      return null
    }

    const state: NeodbTaskStateView = { runId: snapshot.id, status: snapshot.status }
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

  private async requireIdle(): Promise<void> {
    const active = await kisaki.taskRuns.listActiveOwn({ operations: OPERATIONS, limit: 1 })
    if (active.length > 0) {
      throw new NeodbExtensionError('operation_running', m().errors.operationRunning)
    }
  }

  private async runGuarded(
    handle: TaskRunHandle,
    logMessage: string,
    work: () => Promise<void>
  ): Promise<void> {
    try {
      await work()
    } catch (error) {
      if (isCancellationError(error)) {
        await handle.cancel()
        return
      }

      this.deps.logger?.warn(logMessage, toSafeErrorLog(error))
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
