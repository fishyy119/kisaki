/**
 * Batch metadata update runner.
 *
 * Owns the parts of a batch run that carry no entity semantics: task-run
 * lifecycle, duplicate root ids, per-item cancellation checkpoints, counters,
 * bounded failures and warnings, and progress reporting. Per-entity facts come
 * from `INGEST_BATCH_SPECS` (rows and match selection) and from the drivers the
 * service binds per entity (remote search and the single-item update).
 *
 * Cancellation is checked between items only; once an item's update commits it
 * runs to completion.
 */

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { createLogger } from '@main/log'
import type { I18nService } from '@main/services/i18n'
import type { ScrapeSearchResultOf } from '@main/services/scraper'
import { isCancellation, type TaskRunHandle, type TaskRunService } from '@main/services/task-run'
import type * as schema from '@shared/db/schema'
import type { ContentEntityType } from '@shared/entity-types'
import type { IngestUpdateResult } from '@shared/ingest'
import {
  mergeUpdateLookupKnownIds,
  type IngestBatchUpdateRequest,
  type IngestUpdateRequest
} from '@shared/ingest/update'
import type { TaskRunStartResult } from '@shared/task-run'
import { throwIfIngestAborted } from '../run/abort'
import { createIngestRun } from '../run/task-run'
import type { IngestUpdateSurfaceOf } from '../update'
import {
  createBatchTaskRunWarnings,
  getBatchRowQueryName,
  getSafeBatchError,
  pushBoundedFailure,
  pushBoundedItemWarning,
  reportBatchProgress
} from './reporting'
import { loadIngestBatchRows } from './rows'
import { INGEST_BATCH_SPECS } from './specs'
import type {
  IngestBatchCounters,
  IngestBatchFailure,
  IngestBatchItemWarning,
  IngestBatchResult,
  IngestBatchUpdateRow
} from './types'

const log = createLogger('Ingest')

/** The two service calls a batch needs per entity, bound by the ingest service. */
export interface IngestBatchDriver<T extends ContentEntityType> {
  search(
    profileId: string,
    query: string,
    signal: AbortSignal | undefined
  ): Promise<ScrapeSearchResultOf<T>[]>
  update(
    request: IngestUpdateRequest<IngestUpdateSurfaceOf<T>>,
    signal: AbortSignal | undefined
  ): Promise<IngestUpdateResult>
}

export type IngestBatchDrivers = { [T in ContentEntityType]: IngestBatchDriver<T> }

export type IngestBatchUpdateRequestOf<T extends ContentEntityType> = IngestBatchUpdateRequest<
  IngestUpdateSurfaceOf<T>
>

export interface IngestBatchUpdateRunnerDeps {
  db: BetterSQLite3Database<typeof schema>
  taskRun: TaskRunService
  i18n: I18nService
  drivers: IngestBatchDrivers
}

interface IngestBatchPlan<T extends ContentEntityType> {
  entity: T
  request: IngestBatchUpdateRequestOf<T>
  driver: IngestBatchDriver<T>
}

export class IngestBatchUpdateRunner {
  constructor(private readonly deps: IngestBatchUpdateRunnerDeps) {}

  start<T extends ContentEntityType>(
    entity: T,
    request: IngestBatchUpdateRequestOf<T>
  ): TaskRunStartResult {
    const rootIds = requireBatchRootIds(request)
    const messages = this.deps.i18n.messages
    const subjectLabel = messages.ingest.batch.subjectCount({ entity, count: rootIds.length })

    const run = createIngestRun(this.deps.taskRun, {
      operation: `ingest.${entity}.batchUpdate`,
      title: messages.ingest.batch.title({ entity }),
      label: subjectLabel,
      subject: { type: entity },
      initiator: undefined
    })

    void this.execute(run, { entity, request, driver: this.deps.drivers[entity] }, rootIds)
    return { runId: run.id, createdAt: run.createdAt }
  }

  private async execute<T extends ContentEntityType>(
    run: TaskRunHandle,
    plan: IngestBatchPlan<T>,
    rootIds: string[]
  ): Promise<void> {
    const { entity } = plan
    const messages = this.deps.i18n.messages
    const counters: IngestBatchCounters = { succeeded: 0, failed: 0, skipped: 0, warnings: 0 }
    const failures: IngestBatchFailure[] = []
    const itemWarnings: IngestBatchItemWarning[] = []
    const total = rootIds.length

    const progress = (phase: 'searching' | 'updating', current: number, label?: string): void => {
      reportBatchProgress({
        messages,
        context: run.context,
        phase,
        label,
        current,
        total,
        counters,
        failures,
        itemWarnings
      })
    }

    const outcome = (): IngestBatchResult => ({
      total,
      succeeded: counters.succeeded,
      failed: counters.failed,
      skipped: counters.skipped,
      failures,
      warnings: itemWarnings
    })

    try {
      run.start()
      progress('searching', 0, messages.ingest.batch.preparingList({ entity }))

      const rows = loadIngestBatchRows(this.deps.db, INGEST_BATCH_SPECS[entity].rows, rootIds)
      counters.skipped = total - rows.length
      let processed = counters.skipped

      for (const row of rows) {
        await run.context.checkpoint()
        const queryName = getBatchRowQueryName(row)
        progress('searching', processed, queryName)

        try {
          const result = await this.updateItem(plan, row, queryName, run, () =>
            progress('updating', processed, queryName)
          )

          counters.succeeded++
          counters.warnings += result.warnings?.length ?? 0
          for (const warning of result.warnings ?? []) {
            pushBoundedItemWarning(itemWarnings, {
              entityId: row.id,
              name: queryName,
              code: warning.code,
              message: warning.message
            })
          }
        } catch (error) {
          if (isCancellation(error)) {
            throw error
          }

          counters.failed++
          const message = getSafeBatchError(error)
          pushBoundedFailure(failures, { entityId: row.id, name: queryName, error: message })
          log.warn('Batch metadata update item failed.', {
            entity,
            entityId: row.id,
            name: queryName,
            message
          })
        }

        processed++
        progress('updating', processed)
      }

      run.complete({
        title:
          counters.failed > 0
            ? messages.ingest.batch.completedWithFailuresTitle({ entity })
            : messages.ingest.batch.completedTitle({ entity }),
        summary: messages.ingest.batch.resultSummary({
          succeeded: counters.succeeded,
          failed: counters.failed,
          skipped: counters.skipped
        }),
        counters,
        warnings: createBatchTaskRunWarnings(messages, failures, itemWarnings),
        output: outcome()
      })
    } catch (error) {
      if (isCancellation(error)) {
        run.cancel({
          summary: messages.ingest.batch.cancelledSummary({
            succeeded: counters.succeeded,
            failed: counters.failed,
            skipped: counters.skipped
          }),
          counters,
          warnings: createBatchTaskRunWarnings(messages, failures, itemWarnings),
          output: outcome()
        })
        return
      }

      run.fail(error, {
        counters,
        warnings: createBatchTaskRunWarnings(messages, failures, itemWarnings),
        output: outcome()
      })
    }
  }

  private async updateItem<T extends ContentEntityType>(
    plan: IngestBatchPlan<T>,
    row: IngestBatchUpdateRow,
    queryName: string,
    run: TaskRunHandle,
    onUpdateStart: () => void
  ): Promise<IngestUpdateResult> {
    const { entity, request, driver } = plan
    const signal = run.context.signal
    throwIfIngestAborted(signal)
    const results = await driver.search(request.profileId, queryName, signal)
    throwIfIngestAborted(signal)

    const match = INGEST_BATCH_SPECS[entity].selectMatch(this.deps.db, row, results)
    if (!match) {
      throw new Error(this.deps.i18n.messages.ingest.batch.noSearchResults)
    }

    onUpdateStart()

    return driver.update(
      {
        rootId: row.id,
        profileId: request.profileId,
        lookup: {
          name: match.originalName || match.name || queryName,
          knownIds: mergeUpdateLookupKnownIds(
            match.externalIds,
            request.useCurrentExternalIdsAsKnownIds ? row.externalIds : []
          )
        },
        selection: { surfaces: [...request.selection.surfaces] },
        policy: request.policy
      },
      signal
    )
  }
}

/** Duplicate root ids would update the same entity twice within one run. */
function requireBatchRootIds<TSurface extends string>(
  request: IngestBatchUpdateRequest<TSurface>
): string[] {
  const rootIds = [...new Set(request.rootIds)]
  if (rootIds.length === 0) {
    throw new Error('Batch update rootIds are required.')
  }
  if (!request.profileId) {
    throw new Error('Batch update profileId is required.')
  }
  if (request.selection.surfaces.length === 0) {
    throw new Error('Batch update selection is required.')
  }

  return rootIds
}
