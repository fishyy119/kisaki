import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunHandle, TaskRunService } from '@main/services/task-run'
import { isTaskRunCancellation } from '@main/services/task-run'
import { buildIngestUpdateLookup, type PersonBatchUpdateRequest } from '@shared/ingest/update'
import type { TaskRunStartResult } from '@shared/task-run'
import { personExternalIds, persons } from '@shared/db'
import { inArray } from 'drizzle-orm'
import type { PersonUpdateHandler } from '../update'
import { throwIfIngestAborted } from '../types'
import {
  createBatchTaskRunWarnings,
  getBatchRowQueryName,
  getSafeBatchError,
  pushBoundedFailure,
  pushBoundedItemWarning,
  reportBatchProgress,
  type IngestBatchCounters,
  type IngestBatchFailure,
  type IngestBatchItemWarning,
  type IngestBatchResult,
  type IngestBatchUpdateRow
} from './types'

const log = createLogger('Ingest')

export class PersonBatchHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly updateHandler: PersonUpdateHandler,
    private readonly taskRunService: TaskRunService,
    private readonly i18nService: I18nService
  ) {}

  startUpdateFromScraper(request: PersonBatchUpdateRequest): TaskRunStartResult {
    this.validateRequest(request)
    const run = this.taskRunService.runs.create({
      category: 'ingest',
      operation: 'ingest.person.batchUpdate',
      title: this.i18nService.messages.ingest.batch.title({ entity: 'person' }),
      description: this.i18nService.messages.ingest.batch.subjectCount({
        entity: 'person',
        count: request.rootIds.length
      }),
      owner: { type: 'app' },
      initiator: { type: 'user' },
      subject: {
        type: 'person',
        labelSnapshot: this.i18nService.messages.ingest.batch.subjectCount({
          entity: 'person',
          count: request.rootIds.length
        })
      },
      controls: { cancelable: true, pausable: false },
      presentation: {
        notify: {
          enabled: true,
          title: this.i18nService.messages.ingest.batch.title({ entity: 'person' }),
          showProgress: true,
          showResult: true,
          closable: true
        }
      }
    })

    void this.executeUpdateRun(run, request)
    return { runId: run.id, createdAt: run.createdAt }
  }

  private async executeUpdateRun(
    run: TaskRunHandle,
    request: PersonBatchUpdateRequest
  ): Promise<void> {
    const counters: IngestBatchCounters = { succeeded: 0, failed: 0, skipped: 0, warnings: 0 }
    const failures: IngestBatchFailure[] = []
    const itemWarnings: IngestBatchItemWarning[] = []
    const total = request.rootIds.length

    try {
      run.start()
      reportBatchProgress({
        messages: this.i18nService.messages,
        context: run.context,
        phase: 'searching',
        label: this.i18nService.messages.ingest.batch.preparingList({ entity: 'person' }),
        current: 0,
        total,
        counters,
        failures,
        itemWarnings
      })

      const rows = this.loadRows(request.rootIds)
      counters.skipped = Math.max(0, total - rows.length)
      let processed = counters.skipped

      for (const row of rows) {
        await run.context.checkpoint()
        const queryName = getBatchRowQueryName(row)
        const baseKnownIds = request.useCurrentExternalIdsAsKnownIds ? row.externalIds : []

        reportBatchProgress({
          messages: this.i18nService.messages,
          context: run.context,
          phase: 'searching',
          label: queryName,
          current: processed,
          total,
          counters,
          failures,
          itemWarnings
        })

        try {
          throwIfIngestAborted(run.context.signal)
          const searchResults = await this.scraperService.person.search(
            request.profileId,
            queryName
          )
          throwIfIngestAborted(run.context.signal)
          const first = searchResults[0]
          if (!first) {
            throw new Error(this.i18nService.messages.ingest.batch.noSearchResults)
          }

          reportBatchProgress({
            messages: this.i18nService.messages,
            context: run.context,
            phase: 'updating',
            label: queryName,
            current: processed,
            total,
            counters,
            failures,
            itemWarnings
          })

          const result = await this.updateHandler.updateFromScraper(
            {
              rootId: row.id,
              profileId: request.profileId,
              lookup: buildIngestUpdateLookup({
                name: first.originalName || first.name || queryName,
                baseKnownIds,
                selectionKnownIds: first.externalIds
              }),
              selection: { surfaces: [...request.selection.surfaces] },
              policy: request.policy
            },
            { signal: run.context.signal }
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
          if (isTaskRunCancellation(error)) {
            throw error
          }

          counters.failed++
          const message = getSafeBatchError(error)
          pushBoundedFailure(failures, { entityId: row.id, name: queryName, error: message })
          log.warn('Batch person metadata update item failed.', {
            personId: row.id,
            personName: queryName,
            message
          })
        }

        processed++
        reportBatchProgress({
          messages: this.i18nService.messages,
          context: run.context,
          phase: 'updating',
          current: processed,
          total,
          counters,
          failures,
          itemWarnings
        })
      }

      run.complete({
        title:
          counters.failed > 0
            ? this.i18nService.messages.ingest.batch.completedWithFailuresTitle({
                entity: 'person'
              })
            : this.i18nService.messages.ingest.batch.completedTitle({ entity: 'person' }),
        summary: this.i18nService.messages.ingest.batch.resultSummary({
          succeeded: counters.succeeded,
          failed: counters.failed,
          skipped: counters.skipped
        }),
        counters,
        warnings: createBatchTaskRunWarnings(this.i18nService.messages, failures, itemWarnings),
        output: this.createResult(total, counters, failures, itemWarnings)
      })
    } catch (error) {
      if (isTaskRunCancellation(error)) {
        run.cancel({
          summary: this.i18nService.messages.ingest.batch.cancelledSummary({
            succeeded: counters.succeeded,
            failed: counters.failed,
            skipped: counters.skipped
          }),
          counters,
          warnings: createBatchTaskRunWarnings(this.i18nService.messages, failures, itemWarnings),
          output: this.createResult(total, counters, failures, itemWarnings)
        })
        return
      }

      run.fail(error, {
        counters,
        warnings: createBatchTaskRunWarnings(this.i18nService.messages, failures, itemWarnings),
        output: this.createResult(total, counters, failures, itemWarnings)
      })
    }
  }

  private loadRows(ids: string[]): IngestBatchUpdateRow[] {
    const rows = this.dbService.client
      .select({ id: persons.id, name: persons.name, originalName: persons.originalName })
      .from(persons)
      .where(inArray(persons.id, ids))
      .all()

    const extRows = this.dbService.client
      .select({
        personId: personExternalIds.personId,
        source: personExternalIds.source,
        id: personExternalIds.externalId
      })
      .from(personExternalIds)
      .where(inArray(personExternalIds.personId, ids))
      .all()

    const externalIdsById = new Map<string, IngestBatchUpdateRow['externalIds']>()
    for (const row of extRows) {
      const list = externalIdsById.get(row.personId) ?? []
      list.push({ source: row.source, id: row.id })
      externalIdsById.set(row.personId, list)
    }

    const rowById = new Map(rows.map((row) => [row.id, row] as const))
    return ids.flatMap((id) => {
      const row = rowById.get(id)
      return row
        ? [
            {
              id: row.id,
              name: row.name,
              originalName: row.originalName ?? null,
              externalIds: externalIdsById.get(row.id) ?? []
            }
          ]
        : []
    })
  }

  private validateRequest(request: PersonBatchUpdateRequest): void {
    if (request.rootIds.length === 0) {
      throw new Error('Batch update rootIds are required.')
    }
    if (!request.profileId) {
      throw new Error('Batch update profileId is required.')
    }
    if (request.selection.surfaces.length === 0) {
      throw new Error('Batch update selection is required.')
    }
  }

  private createResult(
    total: number,
    counters: IngestBatchCounters,
    failures: IngestBatchFailure[],
    itemWarnings: IngestBatchItemWarning[]
  ): IngestBatchResult {
    return {
      total,
      succeeded: counters.succeeded,
      failed: counters.failed,
      skipped: counters.skipped,
      failures,
      warnings: itemWarnings
    }
  }
}
