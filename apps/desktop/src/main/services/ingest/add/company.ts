import type {
  IngestAddCompanyFromScraperOptions,
  IngestAddCompanyFromScraperResult
} from '@shared/ingest/add'
import type { ScraperLookup } from '@shared/scraper'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunHandle, TaskRunService } from '@main/services/task-run'
import { isTaskRunCancellation } from '@main/services/task-run'
import type { TaskRunStartResult } from '@shared/task-run'
import type { CompanyIngestPersistHandler } from '../persist'
import { requireIngestAllowed, type IngestEntityHooks } from '../hooks'
import { buildCompanyGraph } from '../graph'
import { addCompanyToCollection, normalizeIngestLookupInput, requireScrapedBundle } from './common'
import {
  reportIngestProgress,
  throwIfIngestAborted,
  type IngestOperationOptions,
  type IngestTaskRunOptions
} from '../types'
import { toTaskRunWarnings, waitForIngestRunOutput } from '../task-run'

type CompanyAddFromScraperOptions = IngestAddCompanyFromScraperOptions & IngestOperationOptions
type CompanyAddFromScraperTaskRunOptions = IngestAddCompanyFromScraperOptions & IngestTaskRunOptions

export class CompanyAddHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandler: CompanyIngestPersistHandler,
    private readonly taskRunService: TaskRunService,
    private readonly i18nService: I18nService,
    private readonly hooks: IngestEntityHooks
  ) {}

  startAddFromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: CompanyAddFromScraperTaskRunOptions
  ): TaskRunStartResult {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    const run = this.taskRunService.runs.create({
      category: 'ingest',
      operation: 'ingest.company.add',
      title: this.i18nService.messages.ingest.add.title({ entity: 'company' }),
      description: normalized.lookup.name,
      owner: { type: 'app' },
      initiator: options?.taskRunInitiator ?? { type: 'user' },
      subject: { type: 'company', labelSnapshot: normalized.lookup.name },
      controls: { cancelable: true, pausable: false },
      presentation: {
        notify: {
          enabled: true,
          title: this.i18nService.messages.ingest.add.title({ entity: 'company' }),
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
    options?: CompanyAddFromScraperTaskRunOptions
  ): Promise<IngestAddCompanyFromScraperResult> {
    const start = this.startAddFromScraper(profileId, lookup, options)
    return waitForIngestRunOutput<IngestAddCompanyFromScraperResult>(
      this.taskRunService,
      start.runId
    )
  }

  async addFromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: CompanyAddFromScraperOptions
  ): Promise<IngestAddCompanyFromScraperResult> {
    const normalized = normalizeIngestLookupInput(profileId, lookup)
    throwIfIngestAborted(options?.signal)

    reportIngestProgress(options, {
      phase: 'checking',
      label: this.i18nService.messages.ingest.add.checkingExisting({ entity: 'company' })
    })
    if (normalized.lookup.knownIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExistingCompany({
        externalIds: normalized.lookup.knownIds
      })
      if (existingByExternalId) {
        addCompanyToCollection(this.dbService, existingByExternalId.id, options?.targetCollectionId)

        return {
          companyId: existingByExternalId.id,
          isNew: false,
          existingReason: 'externalId'
        }
      }
    }

    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'scraping',
      label: this.i18nService.messages.ingest.add.scrapingMetadata({ entity: 'company' })
    })
    const bundle = requireScrapedBundle(
      await this.scraperService.company.scrape(normalized.profileId, normalized.lookup),
      'company'
    )
    throwIfIngestAborted(options?.signal)
    reportIngestProgress(options, {
      phase: 'building',
      label: this.i18nService.messages.ingest.add.buildingMetadata({ entity: 'company' })
    })
    const graph = buildCompanyGraph(bundle, normalized.lookup)
    await requireIngestAllowed(this.hooks.committing, {
      name: normalized.lookup.name,
      externalIds: bundle.identity.externalIds
    })
    reportIngestProgress(options, {
      phase: 'writing',
      label: this.i18nService.messages.ingest.add.writing({ entity: 'company' })
    })
    const result = await this.persistHandler.persistCompanyGraph(graph, options)
    this.hooks.committed.dispatch({
      entityId: result.companyId,
      isNew: result.isNew,
      warnings: result.warnings ?? []
    })
    return result
  }

  private async handleAddFromScraperWithTaskRun(
    run: TaskRunHandle,
    profileId: string,
    lookup: ScraperLookup,
    options?: CompanyAddFromScraperTaskRunOptions
  ): Promise<void> {
    try {
      run.start()
      const { taskRunInitiator: _taskRunInitiator, ...operationOptions } = options ?? {}
      const result = await this.addFromScraper(profileId, lookup, {
        ...operationOptions,
        signal: run.context.signal,
        onProgress: (update) => run.context.report(update)
      })
      run.context.throwIfCancelled()
      const warningItems = toTaskRunWarnings(result.warnings)
      run.complete({
        title: result.isNew
          ? this.i18nService.messages.ingest.add.addedTitle({ entity: 'company' })
          : this.i18nService.messages.ingest.add.existsTitle({ entity: 'company' }),
        summary: result.isNew
          ? this.i18nService.messages.ingest.add.addedSummary({ entity: 'company' })
          : this.i18nService.messages.ingest.add.existsSummary({ entity: 'company' }),
        output: result,
        counters: {
          added: result.isNew ? 1 : 0,
          existing: result.isNew ? 0 : 1,
          warnings: result.warnings?.length ?? 0
        },
        warnings: warningItems
      })
    } catch (error) {
      if (isTaskRunCancellation(error)) {
        run.cancel({
          summary: this.i18nService.messages.ingest.add.cancelledSummary({ entity: 'company' })
        })
        return
      }

      run.fail(error)
    }
  }
}
