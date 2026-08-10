/**
 * Batch metadata update runner.
 *
 * Owns the parts of a batch run that carry no entity semantics: task-run
 * lifecycle, duplicate root ids, per-item cancellation checkpoints, counters,
 * bounded failures and warnings, and progress reporting. Entities supply row
 * loading, remote search, and the single-item update.
 *
 * Cancellation is checked between items only; once an item's update commits it
 * runs to completion.
 */

import { createLogger } from '@main/log'
import type { I18nService } from '@main/services/i18n'
import { isCancellation, type TaskRunHandle, type TaskRunService } from '@main/services/task-run'
import type { ExternalId } from '@shared/identity'
import type { IngestUpdateResult } from '@shared/ingest'
import {
  buildIngestUpdateLookup,
  type IngestBatchUpdateRequest,
  type IngestUpdateRequest
} from '@shared/ingest/update'
import type { TaskRunContentEntity, TaskRunStartResult } from '@shared/task-run'
import { throwIfIngestAborted } from '../abort'
import {
  createBatchTaskRunWarnings,
  getBatchRowQueryName,
  getSafeBatchError,
  pushBoundedFailure,
  pushBoundedItemWarning,
  reportBatchProgress
} from './reporting'
import type {
  IngestBatchCounters,
  IngestBatchFailure,
  IngestBatchItemWarning,
  IngestBatchResult,
  IngestBatchUpdateRow
} from './types'

const log = createLogger('Ingest')

/** Minimum a provider search result must carry to drive a batch update. */
export interface IngestBatchSearchMatch {
  name: string
  originalName?: string
  externalIds: ExternalId[]
}

export interface IngestBatchUpdateSpec<TSurface extends string> {
  entity: TaskRunContentEntity
  request: IngestBatchUpdateRequest<TSurface>
  loadRows: (ids: string[]) => IngestBatchUpdateRow[]
  search: (queryName: string, signal: AbortSignal | undefined) => Promise<IngestBatchSearchMatch[]>
  update: (
    request: IngestUpdateRequest<TSurface>,
    signal: AbortSignal | undefined
  ) => Promise<IngestUpdateResult>
}

export class IngestBatchUpdateRunner {
  constructor(
    private readonly taskRunService: TaskRunService,
    private readonly i18nService: I18nService
  ) {}

  start<TSurface extends string>(spec: IngestBatchUpdateSpec<TSurface>): TaskRunStartResult {
    const rootIds = requireBatchRootIds(spec.request)
    const messages = this.i18nService.messages
    const subjectLabel = messages.ingest.batch.subjectCount({
      entity: spec.entity,
      count: rootIds.length
    })

    const run = this.taskRunService.runs.create({
      category: 'ingest',
      operation: `ingest.${spec.entity}.batchUpdate`,
      title: messages.ingest.batch.title({ entity: spec.entity }),
      description: subjectLabel,
      owner: { type: 'app' },
      initiator: { type: 'user' },
      subject: { type: spec.entity, labelSnapshot: subjectLabel },
      controls: { cancelable: true, pausable: false },
      presentation: {
        notify: {
          enabled: true,
          title: messages.ingest.batch.title({ entity: spec.entity }),
          showProgress: true,
          showResult: true,
          closable: true
        }
      }
    })

    void this.execute(run, spec, rootIds)
    return { runId: run.id, createdAt: run.createdAt }
  }

  private async execute<TSurface extends string>(
    run: TaskRunHandle,
    spec: IngestBatchUpdateSpec<TSurface>,
    rootIds: string[]
  ): Promise<void> {
    const messages = this.i18nService.messages
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
      progress('searching', 0, messages.ingest.batch.preparingList({ entity: spec.entity }))

      const rows = spec.loadRows(rootIds)
      counters.skipped = total - rows.length
      let processed = counters.skipped

      for (const row of rows) {
        await run.context.checkpoint()
        const queryName = getBatchRowQueryName(row)
        progress('searching', processed, queryName)

        try {
          const result = await this.updateItem(spec, row, queryName, run, () =>
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
            entity: spec.entity,
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
            ? messages.ingest.batch.completedWithFailuresTitle({ entity: spec.entity })
            : messages.ingest.batch.completedTitle({ entity: spec.entity }),
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

  private async updateItem<TSurface extends string>(
    spec: IngestBatchUpdateSpec<TSurface>,
    row: IngestBatchUpdateRow,
    queryName: string,
    run: TaskRunHandle,
    onUpdateStart: () => void
  ): Promise<IngestUpdateResult> {
    const signal = run.context.signal
    throwIfIngestAborted(signal)
    const matches = await spec.search(queryName, signal)
    throwIfIngestAborted(signal)

    const first = matches[0]
    if (!first) {
      throw new Error(this.i18nService.messages.ingest.batch.noSearchResults)
    }

    onUpdateStart()

    const request = spec.request
    return spec.update(
      {
        rootId: row.id,
        profileId: request.profileId,
        lookup: buildIngestUpdateLookup({
          name: first.originalName || first.name || queryName,
          baseKnownIds: request.useCurrentExternalIdsAsKnownIds ? row.externalIds : [],
          selectionKnownIds: first.externalIds
        }),
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
