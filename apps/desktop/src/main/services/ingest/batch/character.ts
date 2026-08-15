import { characterExternalIdLink, type DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunService } from '@main/services/task-run'
import type { CharacterBatchUpdateRequest } from '@shared/ingest/update'
import type { TaskRunStartResult } from '@shared/task-run'
import { characters } from '@shared/db'
import type { CharacterUpdateHandler } from '../update'
import { IngestBatchUpdateRunner } from './runner'
import { loadIngestBatchRows } from './rows'

export class CharacterBatchHandler {
  private readonly runner: IngestBatchUpdateRunner

  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly updateHandler: CharacterUpdateHandler,
    taskRunService: TaskRunService,
    i18nService: I18nService
  ) {
    this.runner = new IngestBatchUpdateRunner(taskRunService, i18nService)
  }

  startUpdateFromScraper(request: CharacterBatchUpdateRequest): TaskRunStartResult {
    return this.runner.start({
      entity: 'character',
      request,
      loadRows: (ids) =>
        loadIngestBatchRows(
          this.dbService.client,
          {
            table: characters,
            idColumn: characters.id,
            nameColumn: characters.name,
            originalNameColumn: characters.originalName,
            externalIdLink: characterExternalIdLink
          },
          ids
        ),
      findMatch: async (_row, queryName, signal) =>
        (await this.scraperService.character.search(request.profileId, queryName, { signal }))[0] ??
        null,
      update: (updateRequest, signal) =>
        this.updateHandler.updateFromScraper(updateRequest, { signal })
    })
  }
}
