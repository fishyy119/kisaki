import { eq } from 'drizzle-orm'
import { novelExternalIdLink, type DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunService } from '@main/services/task-run'
import type { NovelBatchUpdateRequest } from '@shared/ingest/update'
import { selectNovelSearchResult, type NovelLookupFacts } from '@shared/scraper'
import type { TaskRunStartResult } from '@shared/task-run'
import { novels } from '@shared/db'
import type { NovelUpdateHandler } from '../update'
import { IngestBatchUpdateRunner } from './runner'
import { loadIngestBatchRows } from './rows'

export class NovelBatchHandler {
  private readonly runner: IngestBatchUpdateRunner

  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly updateHandler: NovelUpdateHandler,
    taskRunService: TaskRunService,
    i18nService: I18nService
  ) {
    this.runner = new IngestBatchUpdateRunner(taskRunService, i18nService)
  }

  startUpdateFromScraper(request: NovelBatchUpdateRequest): TaskRunStartResult {
    return this.runner.start({
      entity: 'novel',
      request,
      loadRows: (ids) =>
        loadIngestBatchRows(
          this.dbService.client,
          {
            table: novels,
            idColumn: novels.id,
            nameColumn: novels.name,
            originalNameColumn: novels.originalName,
            externalIdLink: novelExternalIdLink
          },
          ids
        ),
      findMatch: async (row, queryName, signal) =>
        selectNovelSearchResult(
          await this.scraperService.novel.search(request.profileId, queryName, { signal }),
          this.loadFacts(row.id)
        ),
      update: (updateRequest, signal) =>
        this.updateHandler.updateFromScraper(updateRequest, { signal })
    })
  }

  /** What the stored entry states about itself, to rank the search results by. */
  private loadFacts(novelId: string): NovelLookupFacts {
    const stored = this.dbService.client
      .select({ releaseDate: novels.releaseDate, format: novels.format })
      .from(novels)
      .where(eq(novels.id, novelId))
      .get()

    return {
      releaseDate: stored?.releaseDate ?? undefined,
      format: stored?.format
    }
  }
}
