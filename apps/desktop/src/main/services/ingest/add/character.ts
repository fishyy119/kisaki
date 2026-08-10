import type {
  IngestAddCharacterFromScraperOptions,
  IngestAddCharacterFromScraperResult
} from '@shared/ingest/add'
import type { ScraperLookup } from '@shared/scraper'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import { isCancellation, type TaskRunHandle, type TaskRunService } from '@main/services/task-run'
import type { TaskRunStartResult } from '@shared/task-run'
import type { CharacterIngestPersistHandler } from '../persist'
import { requireIngestAllowed, type IngestEntityHooks } from '../hooks'
import { buildCharacterGraph } from '../graph'
import {
  addCharacterToCollection,
  normalizeIngestLookupInput,
  requireScrapedBundle
} from './common'
import { reportIngestProgress } from '../progress'
import { throwIfIngestAborted } from '../abort'
import type { IngestOperationOptions, IngestTaskRunOptions } from '../types'
import { toTaskRunWarnings, waitForIngestRunOutput } from '../task-run'

type CharacterAddFromScraperOptions = IngestAddCharacterFromScraperOptions & IngestOperationOptions
type CharacterAddFromScraperTaskRunOptions = IngestAddCharacterFromScraperOptions &
  IngestTaskRunOptions

export class CharacterAddHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandler: CharacterIngestPersistHandler,
    private readonly taskRunService: TaskRunService,
    private readonly i18nService: I18nService,
    private readonly hooks: IngestEntityHooks
  ) {}

  startAddFromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: CharacterAddFromScraperTaskRunOptions
  ): TaskRunStartResult {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    const run = this.taskRunService.runs.create({
      category: 'ingest',
      operation: 'ingest.character.add',
      title: this.i18nService.messages.ingest.add.title({ entity: 'character' }),
      description: normalized.lookup.name,
      owner: { type: 'app' },
      initiator: options?.taskRunInitiator ?? { type: 'user' },
      subject: { type: 'character', labelSnapshot: normalized.lookup.name },
      controls: { cancelable: true, pausable: false },
      presentation: {
        notify: {
          enabled: true,
          title: this.i18nService.messages.ingest.add.title({ entity: 'character' }),
          showProgress: true,
          showResult: true,
          closable: true
        }
      }
    })

    void this.handleAddFromScraperWithTaskRun(run, normalized.profileId, normalized.lookup, options)
    return { runId: run.id, createdAt: run.createdAt }
  }

  async addFromScraperWithTaskRun(
    profileId: string,
    lookup: ScraperLookup,
    options?: CharacterAddFromScraperTaskRunOptions
  ): Promise<IngestAddCharacterFromScraperResult> {
    const start = this.startAddFromScraper(profileId, lookup, options)
    return waitForIngestRunOutput<IngestAddCharacterFromScraperResult>(
      this.taskRunService,
      start.runId
    )
  }

  async addFromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: CharacterAddFromScraperOptions
  ): Promise<IngestAddCharacterFromScraperResult> {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      label: this.i18nService.messages.ingest.add.checkingExisting({ entity: 'character' })
    })
    if (normalized.lookup.knownIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExistingCharacter({
        externalIds: normalized.lookup.knownIds
      })
      if (existingByExternalId) {
        addCharacterToCollection(
          this.dbService,
          existingByExternalId.id,
          options?.targetCollectionId
        )

        return {
          characterId: existingByExternalId.id,
          isNew: false,
          existingReason: 'externalId'
        }
      }
    }

    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'scraping',
      label: this.i18nService.messages.ingest.add.scrapingMetadata({ entity: 'character' })
    })
    const bundle = requireScrapedBundle(
      await this.scraperService.character.scrape(normalized.profileId, normalized.lookup, {
        signal: options?.signal
      }),
      'character'
    )
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'building',
      label: this.i18nService.messages.ingest.add.buildingMetadata({ entity: 'character' })
    })
    const graph = buildCharacterGraph(bundle, normalized.lookup)
    await requireIngestAllowed(this.hooks.committing, {
      name: normalized.lookup.name,
      externalIds: bundle.identity.externalIds
    })
    reportIngestProgress(options, {
      phase: 'writing',
      label: this.i18nService.messages.ingest.add.writing({ entity: 'character' })
    })
    const result = await this.persistHandler.persistCharacterGraph(graph, options)
    this.hooks.committed.dispatch({
      entityId: result.characterId,
      isNew: result.isNew,
      warnings: result.warnings ?? []
    })
    return result
  }

  private async handleAddFromScraperWithTaskRun(
    run: TaskRunHandle,
    profileId: string,
    lookup: ScraperLookup,
    options?: CharacterAddFromScraperTaskRunOptions
  ): Promise<void> {
    try {
      run.start()
      const { taskRunInitiator: _taskRunInitiator, ...operationOptions } = options ?? {}
      const result = await this.addFromScraper(profileId, lookup, {
        ...operationOptions,
        signal: run.context.signal,
        onProgress: (update) => run.context.report(update)
      })
      const warningItems = toTaskRunWarnings(result.warnings)
      run.complete({
        title: result.isNew
          ? this.i18nService.messages.ingest.add.addedTitle({ entity: 'character' })
          : this.i18nService.messages.ingest.add.existsTitle({ entity: 'character' }),
        summary: result.isNew
          ? this.i18nService.messages.ingest.add.addedSummary({ entity: 'character' })
          : this.i18nService.messages.ingest.add.existsSummary({ entity: 'character' }),
        output: result,
        counters: {
          added: result.isNew ? 1 : 0,
          existing: result.isNew ? 0 : 1,
          warnings: result.warnings?.length ?? 0
        },
        warnings: warningItems
      })
    } catch (error) {
      if (isCancellation(error)) {
        run.cancel({
          summary: this.i18nService.messages.ingest.add.cancelledSummary({ entity: 'character' })
        })
        return
      }

      run.fail(error)
    }
  }
}
