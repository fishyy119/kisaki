import { companyExternalIdLink, type DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunService } from '@main/services/task-run'
import type { CompanyBatchUpdateRequest } from '@shared/ingest/update'
import type { TaskRunStartResult } from '@shared/task-run'
import { companies } from '@shared/db'
import type { CompanyUpdateHandler } from '../update'
import { IngestBatchUpdateRunner } from './runner'
import { loadIngestBatchRows } from './rows'

export class CompanyBatchHandler {
  private readonly runner: IngestBatchUpdateRunner

  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly updateHandler: CompanyUpdateHandler,
    taskRunService: TaskRunService,
    i18nService: I18nService
  ) {
    this.runner = new IngestBatchUpdateRunner(taskRunService, i18nService)
  }

  startUpdateFromScraper(request: CompanyBatchUpdateRequest): TaskRunStartResult {
    return this.runner.start({
      entity: 'company',
      request,
      loadRows: (ids) =>
        loadIngestBatchRows(
          this.dbService.client,
          {
            table: companies,
            idColumn: companies.id,
            nameColumn: companies.name,
            originalNameColumn: companies.originalName,
            externalIdLink: companyExternalIdLink
          },
          ids
        ),
      findMatch: async (_row, queryName, signal) =>
        (await this.scraperService.company.search(request.profileId, queryName, { signal }))[0] ??
        null,
      update: (updateRequest, signal) =>
        this.updateHandler.updateFromScraper(updateRequest, { signal })
    })
  }
}
