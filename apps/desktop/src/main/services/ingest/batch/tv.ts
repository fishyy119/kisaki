import { eq } from 'drizzle-orm'
import { tvExternalIdLink, type DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunService } from '@main/services/task-run'
import type { TvBatchUpdateRequest } from '@shared/ingest/update'
import { selectTvSearchResult, type TvLookupFacts } from '@shared/scraper'
import type { TaskRunStartResult } from '@shared/task-run'
import { tvs } from '@shared/db'
import type { TvUpdateHandler } from '../update'
import { IngestBatchUpdateRunner } from './runner'
import { loadIngestBatchRows } from './rows'

export class TvBatchHandler {
  private readonly runner: IngestBatchUpdateRunner

  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly updateHandler: TvUpdateHandler,
    taskRunService: TaskRunService,
    i18nService: I18nService
  ) {
    this.runner = new IngestBatchUpdateRunner(taskRunService, i18nService)
  }

  startUpdateFromScraper(request: TvBatchUpdateRequest): TaskRunStartResult {
    return this.runner.start({
      entity: 'tv',
      request,
      loadRows: (ids) =>
        loadIngestBatchRows(
          this.dbService.client,
          {
            table: tvs,
            idColumn: tvs.id,
            nameColumn: tvs.name,
            originalNameColumn: tvs.originalName,
            externalIdLink: tvExternalIdLink
          },
          ids
        ),
      findMatch: async (row, queryName, signal) =>
        selectTvSearchResult(
          await this.scraperService.tv.search(request.profileId, queryName, { signal }),
          this.loadFacts(row.id)
        ),
      update: (updateRequest, signal) =>
        this.updateHandler.updateFromScraper(updateRequest, { signal })
    })
  }

  /** What the stored entry states about itself, to rank the search results by. */
  private loadFacts(tvId: string): TvLookupFacts {
    const stored = this.dbService.client
      .select({ releaseDate: tvs.releaseDate, format: tvs.format })
      .from(tvs)
      .where(eq(tvs.id, tvId))
      .get()

    return {
      releaseDate: stored?.releaseDate ?? undefined,
      format: stored?.format
    }
  }
}
