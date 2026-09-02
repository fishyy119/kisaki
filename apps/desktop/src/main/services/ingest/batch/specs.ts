/**
 * Per-entity batch update specs.
 *
 * A batch update is the same algorithm for every entity type; what differs is
 * schema facts (which table and link table hold the rows) and one judgement —
 * which search result a row should rebind to. One work can span many provider
 * entries, and only the entity holds the facts that tell them apart, so media
 * types rank results against what the stored entry states about itself while
 * satellite entities take the first hit.
 */

import { eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type * as schema from '@shared/db/schema'
import {
  animeExternalIdLink,
  characterExternalIdLink,
  comicExternalIdLink,
  companyExternalIdLink,
  gameExternalIdLink,
  novelExternalIdLink,
  personExternalIdLink
} from '@main/services/db'
import type { ScrapeSearchResultOf } from '@main/services/scraper'
import { animes, characters, comics, companies, games, novels, persons } from '@shared/db'
import type { ContentEntityType } from '@shared/entity-types'
import {
  selectAnimeSearchResult,
  selectComicSearchResult,
  selectNovelSearchResult
} from '@shared/scraper'
import type { IngestBatchRowSource } from './rows'
import type { IngestBatchSearchMatch, IngestBatchUpdateRow } from './types'

type DbClient = BetterSQLite3Database<typeof schema>

export interface IngestBatchEntitySpec<T extends ContentEntityType> {
  rows: IngestBatchRowSource
  /** The provider entry the row rebinds to, or null when the search offers none. */
  selectMatch: (
    db: DbClient,
    row: IngestBatchUpdateRow,
    results: ScrapeSearchResultOf<T>[]
  ) => IngestBatchSearchMatch | null
}

export const INGEST_BATCH_SPECS: { [T in ContentEntityType]: IngestBatchEntitySpec<T> } = {
  game: {
    rows: {
      table: games,
      idColumn: games.id,
      nameColumn: games.name,
      originalNameColumn: games.originalName,
      externalIdLink: gameExternalIdLink
    },
    selectMatch: (_db, _row, results) => results[0] ?? null
  },
  anime: {
    rows: {
      table: animes,
      idColumn: animes.id,
      nameColumn: animes.name,
      originalNameColumn: animes.originalName,
      externalIdLink: animeExternalIdLink
    },
    selectMatch: (db, row, results) => {
      const stored = db
        .select({ releaseDate: animes.releaseDate, format: animes.format })
        .from(animes)
        .where(eq(animes.id, row.id))
        .get()
      return selectAnimeSearchResult(results, {
        releaseDate: stored?.releaseDate ?? undefined,
        format: stored?.format
      })
    }
  },
  comic: {
    rows: {
      table: comics,
      idColumn: comics.id,
      nameColumn: comics.name,
      originalNameColumn: comics.originalName,
      externalIdLink: comicExternalIdLink
    },
    selectMatch: (db, row, results) => {
      const stored = db
        .select({ releaseDate: comics.releaseDate, format: comics.format })
        .from(comics)
        .where(eq(comics.id, row.id))
        .get()
      return selectComicSearchResult(results, {
        releaseDate: stored?.releaseDate ?? undefined,
        format: stored?.format
      })
    }
  },
  novel: {
    rows: {
      table: novels,
      idColumn: novels.id,
      nameColumn: novels.name,
      originalNameColumn: novels.originalName,
      externalIdLink: novelExternalIdLink
    },
    selectMatch: (db, row, results) => {
      const stored = db
        .select({ releaseDate: novels.releaseDate, format: novels.format })
        .from(novels)
        .where(eq(novels.id, row.id))
        .get()
      return selectNovelSearchResult(results, {
        releaseDate: stored?.releaseDate ?? undefined,
        format: stored?.format
      })
    }
  },
  person: {
    rows: {
      table: persons,
      idColumn: persons.id,
      nameColumn: persons.name,
      originalNameColumn: persons.originalName,
      externalIdLink: personExternalIdLink
    },
    selectMatch: (_db, _row, results) => results[0] ?? null
  },
  company: {
    rows: {
      table: companies,
      idColumn: companies.id,
      nameColumn: companies.name,
      originalNameColumn: companies.originalName,
      externalIdLink: companyExternalIdLink
    },
    selectMatch: (_db, _row, results) => results[0] ?? null
  },
  character: {
    rows: {
      table: characters,
      idColumn: characters.id,
      nameColumn: characters.name,
      originalNameColumn: characters.originalName,
      externalIdLink: characterExternalIdLink
    },
    selectMatch: (_db, _row, results) => results[0] ?? null
  }
}
