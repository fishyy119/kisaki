import { eq } from 'drizzle-orm'
import { comicExternalIdLink, type DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunService } from '@main/services/task-run'
import type { ComicBatchUpdateRequest } from '@shared/ingest/update'
import { selectComicSearchResult, type ComicLookupFacts } from '@shared/scraper'
import type { TaskRunStartResult } from '@shared/task-run'
import { comics } from '@shared/db'
import type { ComicUpdateHandler } from '../update'
import { IngestBatchUpdateRunner } from './runner'
import { loadIngestBatchRows } from './rows'

export class ComicBatchHandler {
  private readonly runner: IngestBatchUpdateRunner

  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly updateHandler: ComicUpdateHandler,
    taskRunService: TaskRunService,
    i18nService: I18nService
  ) {
    this.runner = new IngestBatchUpdateRunner(taskRunService, i18nService)
  }

  startUpdateFromScraper(request: ComicBatchUpdateRequest): TaskRunStartResult {
    return this.runner.start({
      entity: 'comic',
      request,
      loadRows: (ids) =>
        loadIngestBatchRows(
          this.dbService.client,
          {
            table: comics,
            idColumn: comics.id,
            nameColumn: comics.name,
            originalNameColumn: comics.originalName,
            externalIdLink: comicExternalIdLink
          },
          ids
        ),
      findMatch: async (row, queryName, signal) =>
        selectComicSearchResult(
          await this.scraperService.comic.search(request.profileId, queryName, { signal }),
          this.loadFacts(row.id)
        ),
      update: (updateRequest, signal) =>
        this.updateHandler.updateFromScraper(updateRequest, { signal })
    })
  }

  /** What the stored entry states about itself, to rank the search results by. */
  private loadFacts(comicId: string): ComicLookupFacts {
    const stored = this.dbService.client
      .select({ releaseDate: comics.releaseDate, format: comics.format })
      .from(comics)
      .where(eq(comics.id, comicId))
      .get()

    return {
      releaseDate: stored?.releaseDate ?? undefined,
      format: stored?.format
    }
  }
}
