import { eq } from 'drizzle-orm'
import { movieExternalIdLink, type DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunService } from '@main/services/task-run'
import type { MovieBatchUpdateRequest } from '@shared/ingest/update'
import { selectMovieSearchResult, type MovieLookupFacts } from '@shared/scraper'
import type { TaskRunStartResult } from '@shared/task-run'
import { movies } from '@shared/db'
import type { MovieUpdateHandler } from '../update'
import { IngestBatchUpdateRunner } from './runner'
import { loadIngestBatchRows } from './rows'

export class MovieBatchHandler {
  private readonly runner: IngestBatchUpdateRunner

  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly updateHandler: MovieUpdateHandler,
    taskRunService: TaskRunService,
    i18nService: I18nService
  ) {
    this.runner = new IngestBatchUpdateRunner(taskRunService, i18nService)
  }

  startUpdateFromScraper(request: MovieBatchUpdateRequest): TaskRunStartResult {
    return this.runner.start({
      entity: 'movie',
      request,
      loadRows: (ids) =>
        loadIngestBatchRows(
          this.dbService.client,
          {
            table: movies,
            idColumn: movies.id,
            nameColumn: movies.name,
            originalNameColumn: movies.originalName,
            externalIdLink: movieExternalIdLink
          },
          ids
        ),
      findMatch: async (row, queryName, signal) =>
        selectMovieSearchResult(
          await this.scraperService.movie.search(request.profileId, queryName, { signal }),
          this.loadFacts(row.id)
        ),
      update: (updateRequest, signal) =>
        this.updateHandler.updateFromScraper(updateRequest, { signal })
    })
  }

  /** What the stored entry states about itself, to rank the search results by. */
  private loadFacts(movieId: string): MovieLookupFacts {
    const stored = this.dbService.client
      .select({ releaseDate: movies.releaseDate, format: movies.format })
      .from(movies)
      .where(eq(movies.id, movieId))
      .get()

    return {
      releaseDate: stored?.releaseDate ?? undefined,
      format: stored?.format
    }
  }
}
