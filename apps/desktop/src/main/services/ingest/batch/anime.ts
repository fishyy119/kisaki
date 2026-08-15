import { eq } from 'drizzle-orm'
import { animeExternalIdLink, type DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunService } from '@main/services/task-run'
import type { AnimeBatchUpdateRequest } from '@shared/ingest/update'
import { selectAnimeSearchResult, type AnimeLookupFacts } from '@shared/scraper'
import type { TaskRunStartResult } from '@shared/task-run'
import { animes } from '@shared/db'
import type { AnimeUpdateHandler } from '../update'
import { IngestBatchUpdateRunner } from './runner'
import { loadIngestBatchRows } from './rows'

export class AnimeBatchHandler {
  private readonly runner: IngestBatchUpdateRunner

  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly updateHandler: AnimeUpdateHandler,
    taskRunService: TaskRunService,
    i18nService: I18nService
  ) {
    this.runner = new IngestBatchUpdateRunner(taskRunService, i18nService)
  }

  startUpdateFromScraper(request: AnimeBatchUpdateRequest): TaskRunStartResult {
    return this.runner.start({
      entity: 'anime',
      request,
      loadRows: (ids) =>
        loadIngestBatchRows(
          this.dbService.client,
          {
            table: animes,
            idColumn: animes.id,
            nameColumn: animes.name,
            originalNameColumn: animes.originalName,
            externalIdLink: animeExternalIdLink
          },
          ids
        ),
      findMatch: async (row, queryName, signal) =>
        selectAnimeSearchResult(
          await this.scraperService.anime.search(request.profileId, queryName, { signal }),
          this.loadFacts(row.id)
        ),
      update: (updateRequest, signal) =>
        this.updateHandler.updateFromScraper(updateRequest, { signal })
    })
  }

  /** What the stored entry states about itself, to rank the search results by. */
  private loadFacts(animeId: string): AnimeLookupFacts {
    const stored = this.dbService.client
      .select({ releaseDate: animes.releaseDate, format: animes.format })
      .from(animes)
      .where(eq(animes.id, animeId))
      .get()

    return {
      releaseDate: stored?.releaseDate ?? undefined,
      format: stored?.format
    }
  }
}
