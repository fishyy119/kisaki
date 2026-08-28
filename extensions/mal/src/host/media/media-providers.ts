/**
 * The three media providers MAL contributes.
 *
 * One search endpoint serves each family; the manga family answers both the
 * comic and novel registries, filtered by `media_type`. Mirror-served slots
 * (characters, staff, episodes) are declared as capabilities because the
 * mirror is on by default; with it off those slots come back absent, which
 * consumers already treat as unknown.
 */

import type {
  AnimeScraperLookup,
  AnimeScraperProvider,
  AnimeScraperSession,
  AnimeSearchResult,
  ComicScraperLookup,
  ComicScraperProvider,
  ComicScraperSession,
  ComicSearchResult,
  ExternalId,
  IdResolvedTarget,
  NovelScraperLookup,
  NovelScraperProvider,
  NovelScraperSession,
  NovelSearchResult,
  PartialDate,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import type { MalEntryNode } from '../api/types'
import { findKnownMalId, parseMalId } from '../identity/ids'
import { m } from '../i18n'
import { MAL_SEARCH_RESULT_LIMIT, MAL_SOURCE_ID } from '../utils/constants'
import { MalExtensionError } from '../utils/errors'
import { omitUndefined } from '../utils/object'
import { parseMalDate } from './format/dates'
import { selectMalTitles } from './format/names'
import { toMalExternalId } from './format/sites'
import {
  mapAnimeFormat,
  mapComicFormat,
  mapNovelFormat,
  resolveMangaKind,
  type MalMediaKind
} from './kinds'
import type { MalRuntime } from './runtime'
import {
  createMalAnimeSession,
  createMalComicSession,
  createMalNovelSession,
  createSessionContext,
  type MediaSessionContext
} from './session'

interface SearchCore {
  id: string
  name: string
  originalName?: string
  releaseDate?: PartialDate
  externalIds: ExternalId[]
}

abstract class MalMediaProviderBase {
  public readonly id = MAL_SOURCE_ID
  public readonly name = 'MyAnimeList'
  public readonly externalIdSource = MAL_SOURCE_ID

  protected abstract readonly kind: MalMediaKind

  constructor(protected readonly runtime: MalRuntime) {}

  protected async createContext(ctx: ScraperProviderContext): Promise<MediaSessionContext> {
    return createSessionContext(await this.runtime.getSettings(), ctx.locale, this.runtime.logger)
  }

  /** Searches the family and keeps the rows belonging to this kind. */
  protected async searchItems(
    query: string,
    ctx: ScraperProviderContext
  ): Promise<{ item: MalEntryNode; core: SearchCore }[]> {
    const keyword = query.trim()
    if (!keyword) {
      return []
    }

    const [settings, page] = await Promise.all([
      this.runtime.getSettings(),
      this.kind === 'anime'
        ? this.runtime.official.searchAnime(keyword, MAL_SEARCH_RESULT_LIMIT, {
            signal: ctx.signal
          })
        : this.runtime.official.searchManga(keyword, MAL_SEARCH_RESULT_LIMIT, {
            signal: ctx.signal
          })
    ])

    const results: { item: MalEntryNode; core: SearchCore }[] = []
    for (const entry of page.data ?? []) {
      const item = entry.node
      if (this.kind !== 'anime' && resolveMangaKind(item.media_type) !== this.kind) {
        continue
      }

      const titles = selectMalTitles(item.title, item.alternative_titles, {
        locale: ctx.locale,
        preferRomaji: settings.naming.preferRomajiTitles
      })
      if (!titles) {
        continue
      }

      const externalIds: ExternalId[] = [toMalExternalId(item.id)]
      results.push({
        item,
        core: omitUndefined({
          id: String(item.id),
          name: titles.name,
          originalName: titles.originalName,
          releaseDate: parseMalDate(item.start_date),
          externalIds
        })
      })
    }

    return results
  }

  protected async resolveTarget(
    lookup: AnimeScraperLookup | ComicScraperLookup | NovelScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const known = findKnownMalId(lookup)
    if (known !== null) {
      return this.toTarget(known, lookup.name)
    }

    const results = await this.searchItems(lookup.name, ctx)
    if (results.length === 0) {
      return null
    }

    // Franchises share names; a stated year separates a work from its sequels.
    const wantedYear = lookup.releaseDate?.year
    const match =
      wantedYear !== undefined
        ? (results.find((entry) => entry.core.releaseDate?.year === wantedYear) ?? results[0]!)
        : results[0]!

    return this.toTarget(match.item.id, match.core.name)
  }

  protected requireMediaId(target: IdResolvedTarget): number {
    const id = parseMalId(target.id)
    if (id === null) {
      throw new MalExtensionError('entry_id_invalid', m().errors.idInvalid({ value: target.id }))
    }
    return id
  }

  private toTarget(id: number, resolveName: string): IdResolvedTarget {
    return {
      id: String(id),
      cacheKey: `mal:${this.kind}:${id}`,
      resolveName,
      identity: { externalIds: [toMalExternalId(id)] }
    }
  }
}

export class MalAnimeProvider extends MalMediaProviderBase implements AnimeScraperProvider {
  public readonly capabilities = [
    'search',
    'info',
    'tags',
    'characters',
    'persons',
    'companies',
    'episodes',
    'relatedEntries',
    'covers'
  ] as const
  protected readonly kind = 'anime' as const

  async search(query: string, ctx: ScraperProviderContext): Promise<AnimeSearchResult[]> {
    const results = await this.searchItems(query, ctx)
    return results.map(({ item, core }) =>
      omitUndefined({ ...core, format: mapAnimeFormat(item.media_type) })
    )
  }

  async resolve(
    lookup: AnimeScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    return this.resolveTarget(lookup, ctx)
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<AnimeScraperSession> {
    return createMalAnimeSession(
      this.runtime,
      this.requireMediaId(target),
      await this.createContext(ctx),
      ctx.signal
    )
  }
}

export class MalComicProvider extends MalMediaProviderBase implements ComicScraperProvider {
  public readonly capabilities = [
    'search',
    'info',
    'tags',
    'characters',
    'persons',
    'companies',
    'relatedEntries',
    'covers'
  ] as const
  protected readonly kind = 'comic' as const

  async search(query: string, ctx: ScraperProviderContext): Promise<ComicSearchResult[]> {
    const results = await this.searchItems(query, ctx)
    return results.map(({ item, core }) =>
      omitUndefined({ ...core, format: mapComicFormat(item.media_type) })
    )
  }

  async resolve(
    lookup: ComicScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    return this.resolveTarget(lookup, ctx)
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<ComicScraperSession> {
    return createMalComicSession(
      this.runtime,
      this.requireMediaId(target),
      await this.createContext(ctx),
      ctx.signal
    )
  }
}

export class MalNovelProvider extends MalMediaProviderBase implements NovelScraperProvider {
  public readonly capabilities = [
    'search',
    'info',
    'tags',
    'characters',
    'persons',
    'companies',
    'relatedEntries',
    'covers'
  ] as const
  protected readonly kind = 'novel' as const

  async search(query: string, ctx: ScraperProviderContext): Promise<NovelSearchResult[]> {
    const results = await this.searchItems(query, ctx)
    return results.map(({ item, core }) =>
      omitUndefined({ ...core, format: mapNovelFormat(item.media_type) })
    )
  }

  async resolve(
    lookup: NovelScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    return this.resolveTarget(lookup, ctx)
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<NovelScraperSession> {
    return createMalNovelSession(
      this.runtime,
      this.requireMediaId(target),
      await this.createContext(ctx),
      ctx.signal
    )
  }
}
