/**
 * Entity update engine.
 *
 * One flow for every content entity: resolve the lookup, scrape, project the
 * planning facts, gatekeep through the updating hook, apply inside one
 * synchronous transaction, flush deferred assets, and notify. Everything
 * per-entity is declared in `specs.ts` and the entity's `update/<entity>/`
 * pipeline segments; the task-run wrapper lives here once as well.
 */

import { createLogger } from '@main/log'
import type { I18nService } from '@main/services/i18n'
import { isCancellation, type TaskRunHandle, type TaskRunService } from '@main/services/task-run'
import type { ContentEntityType } from '@shared/entity-types'
import type { IngestUpdateResult } from '@shared/ingest'
import type { TaskRunStartResult } from '@shared/task-run'
import { flushPendingAssets } from '../assets'
import { requireIngestAllowed, type IngestEntityHooks } from '../hooks'
import { throwIfIngestAborted } from '../run/abort'
import { reportIngestProgress } from '../run/progress'
import { createIngestRun, toTaskRunWarnings } from '../run/task-run'
import type { IngestOperationOptions, IngestTaskRunOptions } from '../types'
import { normalizePolicy } from './shared/policy'
import { requireUpdateRequest } from './shared/request'
import type { IngestUpdateDeps, IngestUpdateRequestOf, IngestUpdateSpec } from './specs'

const log = createLogger('Ingest')

export interface EntityUpdateEngineDeps extends IngestUpdateDeps {
  taskRunService: TaskRunService
  i18nService: I18nService
}

/** Facade every content entity exposes. */
export interface EntityUpdateApi<T extends ContentEntityType> {
  startUpdateFromScraper(
    request: IngestUpdateRequestOf<T>,
    options?: IngestTaskRunOptions
  ): TaskRunStartResult
  updateFromScraper(
    request: IngestUpdateRequestOf<T>,
    options?: IngestOperationOptions
  ): Promise<IngestUpdateResult>
}

export class EntityUpdateEngine<T extends ContentEntityType> implements EntityUpdateApi<T> {
  constructor(
    private readonly entityType: T,
    private readonly spec: IngestUpdateSpec<T>,
    private readonly deps: EntityUpdateEngineDeps,
    private readonly hooks: IngestEntityHooks
  ) {}

  private get messages() {
    return this.deps.i18nService.messages
  }

  startUpdateFromScraper(
    request: IngestUpdateRequestOf<T>,
    options?: IngestTaskRunOptions
  ): TaskRunStartResult {
    requireUpdateRequest(request)
    const run = createIngestRun(this.deps.taskRunService, {
      operation: `ingest.${this.entityType}.update`,
      title: this.messages.ingest.update.title({ entity: this.entityType }),
      label: request.lookup.name,
      subject: { type: this.entityType, id: request.rootId },
      initiator: options?.taskRunInitiator
    })

    void this.executeRun(run, request)
    return { runId: run.id, createdAt: run.createdAt }
  }

  async updateFromScraper(
    request: IngestUpdateRequestOf<T>,
    options?: IngestOperationOptions
  ): Promise<IngestUpdateResult> {
    requireUpdateRequest(request)
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'preparing',
      label: this.messages.ingest.update.preparing({ entity: this.entityType })
    })
    const lookup = this.spec.resolveLookup(this.deps, request)
    const policy = normalizePolicy(request.policy)

    reportIngestProgress(options, {
      phase: 'scraping',
      label: this.messages.ingest.update.scrapingMetadata({ entity: this.entityType })
    })
    const bundle = await this.spec.scrape(this.deps, request.profileId, lookup, options?.signal)
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'planning',
      label: this.messages.ingest.update.planning({ entity: this.entityType })
    })
    const { surfaces, planning } = this.spec.plan(this.deps, { request, lookup, bundle })
    throwIfIngestAborted(options?.signal)
    await requireIngestAllowed(this.hooks.updating, {
      entityId: request.rootId,
      name: lookup.name,
      surfaces,
      externalIds: lookup.knownIds ?? []
    })
    reportIngestProgress(options, {
      phase: 'writing',
      label: this.messages.ingest.update.writing({ entity: this.entityType })
    })
    // Read, plan and apply share one synchronous transaction: planning against a
    // snapshot taken outside it would overwrite concurrent edits.
    const applied = this.deps.dbService.client.transaction((tx) =>
      this.spec.apply(this.deps, tx, { rootId: request.rootId, planning, policy })
    )

    if (applied.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: this.messages.ingest.persist.savingMedia({ entity: this.entityType })
      })
    }
    const warnings = [
      ...applied.warnings,
      ...(await flushPendingAssets(this.deps.dbService, applied.pendingAssets, {
        signal: options?.signal
      }))
    ]
    if (warnings.length > 0) {
      log.warn('Update completed with warnings.', {
        entityType: this.entityType,
        warningsItemsText: warnings.map((warning) => warning.message).join(' | ')
      })
    }

    this.hooks.updated.dispatch({ entityId: request.rootId, surfaces, warnings })
    return warnings.length > 0 ? { warnings } : {}
  }

  private async executeRun(run: TaskRunHandle, request: IngestUpdateRequestOf<T>): Promise<void> {
    try {
      run.start()
      const result = await this.updateFromScraper(request, {
        signal: run.context.signal,
        onProgress: (update) => run.context.report(update)
      })
      run.complete({
        title: this.messages.ingest.update.completedTitle({ entity: this.entityType }),
        summary: this.messages.ingest.update.completedSummary({ entity: this.entityType }),
        output: {
          [this.spec.outputIdKey]: request.rootId,
          ...result
        },
        counters: {
          updated: 1,
          warnings: result.warnings?.length ?? 0
        },
        warnings: toTaskRunWarnings(result.warnings)
      })
    } catch (error) {
      if (isCancellation(error)) {
        run.cancel({
          summary: this.messages.ingest.update.cancelledSummary({ entity: this.entityType })
        })
        return
      }

      run.fail(error)
    }
  }
}
