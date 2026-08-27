/**
 * Entity add engine.
 *
 * One flow for every content entity: resolve an already-existing entry,
 * scrape (or take the direct seed), build the graph, gatekeep through the
 * committing hook, persist, and notify. Everything per-entity is a fact or an
 * injected function declared in `specs.ts`; the task-run wrapper around the
 * flow lives here once as well.
 */

import type { I18nService } from '@main/services/i18n'
import { isCancellation, type TaskRunHandle, type TaskRunService } from '@main/services/task-run'
import type { ContentEntityType, MediaType } from '@shared/common'
import type { ExternalId } from '@shared/identity'
import type { TaskRunInitiator, TaskRunStartResult } from '@shared/task-run'
import { requireIngestAllowed, type IngestEntityHooks } from '../hooks'
import { throwIfIngestAborted } from '../run/abort'
import { reportIngestProgress } from '../run/progress'
import { createIngestRun, toTaskRunWarnings } from '../run/task-run'
import type { IngestOperationOptions, IngestTaskRunOptions } from '../types'
import { normalizeIngestLookupInput, normalizeLookup, requireScrapedBundle } from './common'
import type {
  IngestAddDeps,
  IngestAddLookup,
  IngestAddOptions,
  IngestAddResultOf,
  IngestAddSeed,
  IngestAddSpec
} from './specs'

export interface EntityAddEngineDeps extends IngestAddDeps {
  taskRunService: TaskRunService
  i18nService: I18nService
}

/** Facade every content entity exposes. */
export interface EntityAddApi<T extends ContentEntityType> {
  startAddFromScraper(
    profileId: string,
    lookup: IngestAddLookup<T>,
    options?: IngestAddOptions<T> & IngestTaskRunOptions
  ): TaskRunStartResult
  addFromScraper(
    profileId: string,
    lookup: IngestAddLookup<T>,
    options?: IngestAddOptions<T> & IngestOperationOptions
  ): Promise<IngestAddResultOf<T>>
}

/** Media entries also add directly from seed facts, without a scraper. */
export interface MediaEntityAddApi<T extends ContentEntityType & MediaType>
  extends EntityAddApi<T> {
  startAddDirect(
    seed: IngestAddSeed<T>,
    options?: IngestAddOptions<T> & IngestTaskRunOptions
  ): TaskRunStartResult
  addDirect(
    seed: IngestAddSeed<T>,
    options?: IngestAddOptions<T> & IngestOperationOptions
  ): Promise<IngestAddResultOf<T>>
}

type RunOptions<T extends ContentEntityType> = IngestAddOptions<T> & IngestOperationOptions

export class EntityAddEngine<T extends ContentEntityType> {
  constructor(
    private readonly entityType: T,
    private readonly spec: IngestAddSpec<T>,
    private readonly deps: EntityAddEngineDeps,
    private readonly hooks: IngestEntityHooks
  ) {}

  private get messages() {
    return this.deps.i18nService.messages
  }

  startAddFromScraper(
    profileId: string,
    lookup: IngestAddLookup<T>,
    options?: IngestAddOptions<T> & IngestTaskRunOptions
  ): TaskRunStartResult {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    return this.startRun(normalized.lookup.name, options?.taskRunInitiator, (runOptions) =>
      this.addFromScraper(
        normalized.profileId,
        normalized.lookup,
        this.mergeRunOptions(options, runOptions)
      )
    )
  }

  async addFromScraper(
    profileId: string,
    lookup: IngestAddLookup<T>,
    options?: RunOptions<T>
  ): Promise<IngestAddResultOf<T>> {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      label: this.messages.ingest.add.checkingExisting({ entity: this.entityType })
    })
    const existing = this.tryResolveExisting(normalized.lookup.knownIds, options)
    if (existing) {
      return existing
    }

    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'scraping',
      label: this.messages.ingest.add.scrapingMetadata({ entity: this.entityType })
    })
    const bundle = requireScrapedBundle(
      await this.spec.scrape(this.deps, normalized.profileId, normalized.lookup, options?.signal),
      this.entityType
    )
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'building',
      label: this.messages.ingest.add.buildingMetadata({ entity: this.entityType })
    })
    const graph = this.spec.buildGraph(bundle, normalized.lookup)
    await requireIngestAllowed(this.hooks.committing, {
      name: normalized.lookup.name,
      externalIds: bundle.identity.externalIds
    })
    reportIngestProgress(options, {
      phase: 'writing',
      label: this.messages.ingest.add.writing({ entity: this.entityType })
    })
    const result = await this.spec.persist(this.deps, graph, options)
    this.hooks.committed.dispatch({
      entityId: this.spec.readEntityId(result),
      isNew: result.isNew,
      warnings: result.warnings ?? []
    })
    return result
  }

  startAddDirect(
    seed: IngestAddSeed<T>,
    options?: IngestAddOptions<T> & IngestTaskRunOptions
  ): TaskRunStartResult {
    const normalizedLookup = normalizeLookup({ name: seed.name, knownIds: seed.knownIds })
    return this.startRun(normalizedLookup.name, options?.taskRunInitiator, (runOptions) =>
      this.addDirect(
        { ...seed, name: normalizedLookup.name },
        this.mergeRunOptions(options, runOptions)
      )
    )
  }

  async addDirect(seed: IngestAddSeed<T>, options?: RunOptions<T>): Promise<IngestAddResultOf<T>> {
    const buildDirectGraph = this.spec.buildDirectGraph
    if (!buildDirectGraph) {
      throw new Error(`Direct add is not supported for ${this.entityType}.`)
    }

    const normalizedLookup = normalizeLookup({ name: seed.name, knownIds: seed.knownIds })
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      label: this.messages.ingest.add.checkingExisting({ entity: this.entityType }),
      phaseCurrent: 1,
      phaseTotal: 2
    })
    const existing = this.tryResolveExisting(normalizedLookup.knownIds, options)
    if (existing) {
      return existing
    }

    throwIfIngestAborted(options?.signal)
    await requireIngestAllowed(this.hooks.committing, {
      name: normalizedLookup.name,
      externalIds: normalizedLookup.knownIds ?? []
    })
    reportIngestProgress(options, {
      phase: 'writing',
      label: this.messages.ingest.add.writing({ entity: this.entityType }),
      phaseCurrent: 2,
      phaseTotal: 2
    })
    const graph = buildDirectGraph(normalizedLookup)
    const result = await this.spec.persist(this.deps, graph, options)
    this.hooks.committed.dispatch({
      entityId: this.spec.readEntityId(result),
      isNew: result.isNew,
      warnings: result.warnings ?? []
    })
    return result
  }

  private tryResolveExisting(
    knownIds: ExternalId[] | undefined,
    options: RunOptions<T> | undefined
  ): IngestAddResultOf<T> | undefined {
    const dirPath = this.spec.dirPathOf(options)
    if (dirPath) {
      const existingByPath = this.spec.findExisting(this.deps, { path: dirPath })
      if (existingByPath) {
        this.spec.addToCollection(this.deps, existingByPath.id, options?.targetCollectionId)
        return this.spec.toExistingResult(existingByPath.id, 'path')
      }
    }

    if (knownIds?.length) {
      const existingByExternalId = this.spec.findExisting(this.deps, { externalIds: knownIds })
      if (existingByExternalId) {
        this.spec.addToCollection(this.deps, existingByExternalId.id, options?.targetCollectionId)
        return this.spec.toExistingResult(existingByExternalId.id, 'externalId')
      }
    }

    return undefined
  }

  // ---------------------------------------------------------------------------
  // Task-run wrapper
  // ---------------------------------------------------------------------------

  private startRun(
    label: string,
    initiator: TaskRunInitiator | undefined,
    execute: (runOptions: IngestOperationOptions) => Promise<IngestAddResultOf<T>>
  ): TaskRunStartResult {
    const run = createIngestRun(this.deps.taskRunService, {
      operation: `ingest.${this.entityType}.add`,
      title: this.messages.ingest.add.title({ entity: this.entityType }),
      label,
      subject: { type: this.entityType },
      initiator
    })

    void this.executeRun(run, execute)
    return { runId: run.id, createdAt: run.createdAt }
  }

  /**
   * Merges caller options with the run-bound signal and progress sink.
   *
   * This is the engine's one owned correlation point: dropping the initiator
   * key from the generic options cannot be expressed without an assertion.
   */
  private mergeRunOptions(
    options: (IngestAddOptions<T> & IngestTaskRunOptions) | undefined,
    runOptions: IngestOperationOptions
  ): RunOptions<T> {
    const { taskRunInitiator: _initiator, ...addOptions } = options ?? {}
    return { ...addOptions, ...runOptions } as RunOptions<T>
  }

  private async executeRun(
    run: TaskRunHandle,
    execute: (runOptions: IngestOperationOptions) => Promise<IngestAddResultOf<T>>
  ): Promise<void> {
    try {
      run.start()
      const result = await execute({
        signal: run.context.signal,
        onProgress: (update) => run.context.report(update)
      })
      this.completeRun(run, result)
    } catch (error) {
      this.finishRunFromError(run, error)
    }
  }

  private completeRun(run: TaskRunHandle, result: IngestAddResultOf<T>): void {
    run.complete({
      title: result.isNew
        ? this.messages.ingest.add.addedTitle({ entity: this.entityType })
        : this.messages.ingest.add.existsTitle({ entity: this.entityType }),
      summary: result.isNew
        ? this.messages.ingest.add.addedSummary({ entity: this.entityType })
        : this.messages.ingest.add.existsSummary({ entity: this.entityType }),
      output: result,
      counters: {
        added: result.isNew ? 1 : 0,
        existing: result.isNew ? 0 : 1,
        warnings: result.warnings?.length ?? 0
      },
      warnings: toTaskRunWarnings(result.warnings)
    })
  }

  private finishRunFromError(run: TaskRunHandle, error: unknown): void {
    if (isCancellation(error)) {
      run.cancel({
        summary: this.messages.ingest.add.cancelledSummary({ entity: this.entityType })
      })
      return
    }

    run.fail(error)
  }
}
