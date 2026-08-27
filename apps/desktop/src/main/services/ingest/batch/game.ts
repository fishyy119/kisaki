import { gameExternalIdLink, type DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunService } from '@main/services/task-run'
import type { GameBatchUpdateRequest } from '@shared/ingest/update'
import type { TaskRunStartResult } from '@shared/task-run'
import { games } from '@shared/db'
import type { EntityUpdateApi } from '../update'
import { IngestBatchUpdateRunner } from './runner'
import { loadIngestBatchRows } from './rows'

export class GameBatchHandler {
  private readonly runner: IngestBatchUpdateRunner

  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly updateHandler: EntityUpdateApi<'game'>,
    taskRunService: TaskRunService,
    i18nService: I18nService
  ) {
    this.runner = new IngestBatchUpdateRunner(taskRunService, i18nService)
  }

  startUpdateFromScraper(request: GameBatchUpdateRequest): TaskRunStartResult {
    return this.runner.start({
      entity: 'game',
      request,
      loadRows: (ids) =>
        loadIngestBatchRows(
          this.dbService.client,
          {
            table: games,
            idColumn: games.id,
            nameColumn: games.name,
            originalNameColumn: games.originalName,
            externalIdLink: gameExternalIdLink
          },
          ids
        ),
      findMatch: async (_row, queryName, signal) =>
        (await this.scraperService.game.search(request.profileId, queryName, { signal }))[0] ??
        null,
      update: (updateRequest, signal) =>
        this.updateHandler.updateFromScraper(updateRequest, { signal })
    })
  }
}
