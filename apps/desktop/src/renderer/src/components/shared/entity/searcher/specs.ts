/**
 * Entity searcher specs.
 *
 * Every entity is searched the same way (pick a profile, search by name, pick a
 * row, or type a provider id). The spec owns the three things that differ: the
 * search channel, the columns that tell candidate rows apart, and the lookup
 * facts a picked row contributes.
 */

import { ipcManager } from '@renderer/core/ipc'
import type { ContentEntityType } from '@shared/common'
import type { I18nFormatters, Messages } from '@shared/i18n'
import type { IpcResult } from '@shared/ipc'
import type {
  AnimeScraperLookup,
  AnimeSearchResult,
  CharacterSearchResult,
  ComicScraperLookup,
  ComicSearchResult,
  CompanySearchResult,
  GameScraperLookup,
  GameSearchResult,
  NovelScraperLookup,
  NovelSearchResult,
  PersonSearchResult,
  ScraperLookup
} from '@shared/scraper'

/** Search result row type per entity type. */
export interface SearchResultMap {
  game: GameSearchResult
  anime: AnimeSearchResult
  comic: ComicSearchResult
  novel: NovelSearchResult
  character: CharacterSearchResult
  person: PersonSearchResult
  company: CompanySearchResult
}

/** Lookup contract per entity type; satellites are named by name and ids alone. */
export interface ScraperLookupMap {
  game: GameScraperLookup
  anime: AnimeScraperLookup
  comic: ComicScraperLookup
  novel: NovelScraperLookup
  character: ScraperLookup
  person: ScraperLookup
  company: ScraperLookup
}

export interface SearcherColumn<TResult> {
  /** Colgroup width; an empty string lets the column flex. */
  width: string
  header: (m: Messages) => string
  /** Cell text, already formatted and with its own empty placeholder. */
  cell: (result: TResult, m: Messages, f: I18nFormatters) => string
}

export interface EntitySearcherSpec<TResult, TLookup extends ScraperLookup> {
  search: (profileId: string, query: string) => Promise<IpcResult<TResult[]>>
  /** Result columns in display order; the first one carries the name. */
  columns: readonly SearcherColumn<TResult>[]
  /**
   * Completes the lookup with the facts the picked row states, so a provider
   * without a known id can tell this entry from the others sharing its name.
   */
  buildLookup: (base: ScraperLookup, result: TResult | null) => TLookup
}

type EntitySearcherSpecs = {
  [T in ContentEntityType]: EntitySearcherSpec<SearchResultMap[T], ScraperLookupMap[T]>
}

/** Name column, shared by every entity: the row's own name, always present. */
function nameColumn<TResult extends { name: string }>(): SearcherColumn<TResult> {
  return {
    width: '',
    header: (m) => m.library.searcher.columnName,
    cell: (result) => result.name
  }
}

function originalNameColumn<TResult extends { originalName?: string }>(
  width: string
): SearcherColumn<TResult> {
  return {
    width,
    header: (m) => m.library.searcher.columnOriginalName,
    cell: (result, m) => result.originalName || m.common.emptyValue
  }
}

export const SEARCHER_SPECS: EntitySearcherSpecs = {
  game: {
    search: (profileId, query) => ipcManager.invoke('scraper:search-game', profileId, query),
    columns: [
      nameColumn(),
      originalNameColumn('30%'),
      {
        width: '7.5rem',
        header: (m) => m.library.searcher.columnReleaseDate,
        cell: (result, m, f) =>
          result.releaseDate ? f.date(result.releaseDate) : m.common.emptyValue
      }
    ],
    // The picked row states which release this is, so providers without a known
    // id can tell it from the rest of the title's entries.
    buildLookup: (base, result) => ({ ...base, releaseDate: result?.releaseDate })
  },
  anime: {
    search: (profileId, query) => ipcManager.invoke('scraper:search-anime', profileId, query),
    columns: [
      nameColumn(),
      originalNameColumn('25%'),
      {
        // A name search spans every entry of a work, so the kind of entry is
        // what tells a season from the film that shares its name.
        width: '5rem',
        header: (m) => m.library.fields.format,
        cell: (result, m) =>
          result.format ? m.library.animeFormat[result.format] : m.common.emptyValue
      },
      {
        width: '7.5rem',
        header: (m) => m.library.searcher.columnReleaseDate,
        cell: (result, m, f) =>
          result.releaseDate ? f.date(result.releaseDate) : m.common.emptyValue
      }
    ],
    buildLookup: (base, result) => ({
      ...base,
      releaseDate: result?.releaseDate,
      format: result?.format
    })
  },
  comic: {
    search: (profileId, query) => ipcManager.invoke('scraper:search-comic', profileId, query),
    columns: [
      nameColumn(),
      originalNameColumn('25%'),
      {
        // A name search spans every entry of a work, so the kind of entry is
        // what tells the serialization from the spin-off that shares its name.
        width: '5rem',
        header: (m) => m.library.fields.format,
        cell: (result, m) =>
          result.format ? m.library.comicFormat[result.format] : m.common.emptyValue
      },
      {
        width: '7.5rem',
        header: (m) => m.library.searcher.columnReleaseDate,
        cell: (result, m, f) =>
          result.releaseDate ? f.date(result.releaseDate) : m.common.emptyValue
      }
    ],
    buildLookup: (base, result) => ({
      ...base,
      releaseDate: result?.releaseDate,
      format: result?.format
    })
  },
  novel: {
    search: (profileId, query) => ipcManager.invoke('scraper:search-novel', profileId, query),
    columns: [
      nameColumn(),
      originalNameColumn('25%'),
      {
        width: '5rem',
        header: (m) => m.library.fields.format,
        cell: (result, m) =>
          result.format ? m.library.novelFormat[result.format] : m.common.emptyValue
      },
      {
        width: '7.5rem',
        header: (m) => m.library.searcher.columnReleaseDate,
        cell: (result, m, f) =>
          result.releaseDate ? f.date(result.releaseDate) : m.common.emptyValue
      }
    ],
    buildLookup: (base, result) => ({
      ...base,
      releaseDate: result?.releaseDate,
      format: result?.format
    })
  },
  character: {
    search: (profileId, query) => ipcManager.invoke('scraper:search-character', profileId, query),
    columns: [
      nameColumn(),
      originalNameColumn('35%'),
      {
        width: '8rem',
        header: (m) => m.library.searcher.columnBirth,
        cell: (result, m, f) => (result.birthDate ? f.date(result.birthDate) : m.common.emptyValue)
      }
    ],
    buildLookup: (base) => base
  },
  person: {
    search: (profileId, query) => ipcManager.invoke('scraper:search-person', profileId, query),
    columns: [
      nameColumn(),
      originalNameColumn('28%'),
      {
        width: '7rem',
        header: (m) => m.library.searcher.columnBirth,
        cell: (result, m, f) => (result.birthDate ? f.date(result.birthDate) : m.common.emptyValue)
      },
      {
        width: '7rem',
        header: (m) => m.library.searcher.columnDeath,
        cell: (result, m, f) => (result.deathDate ? f.date(result.deathDate) : m.common.emptyValue)
      }
    ],
    buildLookup: (base) => base
  },
  company: {
    search: (profileId, query) => ipcManager.invoke('scraper:search-company', profileId, query),
    columns: [
      nameColumn(),
      originalNameColumn('35%'),
      {
        width: '8rem',
        header: (m) => m.library.searcher.columnFounded,
        cell: (result, m, f) =>
          result.foundedDate ? f.date(result.foundedDate) : m.common.emptyValue
      }
    ],
    buildLookup: (base) => base
  }
}
