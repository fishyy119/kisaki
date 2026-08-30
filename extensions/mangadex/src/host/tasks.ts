import { kisaki, type ExtensionLogger, type TaskRunHandle } from '@kisaki3/extension-sdk'
import type { MangadexTaskStateView } from '../shared/settings'
import type { MangadexClient } from './api/client'
import { m } from './i18n'
import { runStatusImport, type ImportOptions, type ImportSummary } from './import/runner'
import { listAllComics, readMangadexId } from './library'
import type { SyncEngine } from './sync/engine'
import { MangadexExtensionError, toSafeErrorLog } from './utils/errors'

const IMPORT_OPERATION = 'mangadex.status-import'
const PUSH_OPERATION = 'mangadex.status-push'
const OPERATIONS = [IMPORT_OPERATION, PUSH_OPERATION]

export interface MangadexTasksDependencies {
  client: MangadexClient
  engine: SyncEngine
  logger?: ExtensionLogger
}

/**
 * Runs status import and full push as app task runs.
 *
 * Both operations walk whole lists, so only one may run at a time; the
 * task-run surface supplies progress, cancellation, and history for free.
 */
export class MangadexTasks {
  constructor(private readonly deps: MangadexTasksDependencies) {}

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

    void this.runGuarded(handle, 'MangaDex status import failed.', async () => {
      const summary = await runStatusImport(
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

    void this.runGuarded(handle, 'MangaDex full push failed.', async () => {
      const comicIds: string[] = []
      for (const entry of await listAllComics()) {
        if (readMangadexId(entry.externalIds ?? []) !== null) {
          comicIds.push(entry.id)
        }
      }

      let pushed = 0
      let skipped = 0
      let failed = 0

      for (const [index, comicId] of comicIds.entries()) {
        handle.signal.throwIfAborted()

        try {
          const result = await this.deps.engine.syncItem(comicId, {
            signal: handle.signal,
            force: true
          })
          if (result.status === 'synced') {
            pushed += 1
          } else {
            skipped += 1
          }
        } catch (error) {
          if (handle.signal.aborted) {
            throw error
          }
          failed += 1
          this.deps.logger?.warn('MangaDex push failed for one entry.', {
            comicId,
            ...toSafeErrorLog(error)
          })
        }

        if ((index + 1) % 5 === 0 || index + 1 === comicIds.length) {
          await handle.report({
            work: { current: index + 1, total: comicIds.length, unit: 'entity' },
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

  async getTaskState(runId: string): Promise<MangadexTaskStateView | null> {
    const snapshot =
      (await kisaki.taskRuns.getActiveOwn(runId)) ?? (await kisaki.taskRuns.getHistoryOwn(runId))
    if (!snapshot) {
      return null
    }

    const state: MangadexTaskStateView = { runId: snapshot.id, status: snapshot.status }
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
      throw new MangadexExtensionError('operation_running', m().errors.operationRunning)
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
      if (handle.signal.aborted) {
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
