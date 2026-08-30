/**
 * The three media providers AniList contributes.
 *
 * One Media entity serves anime, comics, and novels, so search, resolve, and
 * session opening share their internals and each provider only owns its kind
 * filter and result shaping.
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
  IdResolvedTarget,
  NovelScraperLookup,
  NovelScraperProvider,
  NovelScraperSession,
  NovelSearchResult,
  PartialDate,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import type { ExternalId } from '@kisaki3/extension-sdk'
import type { AnilistMediaSearchItem } from '../api/types'
import { findKnownAnilistId, parseAnilistId } from '../identity/ids'
import { m } from '../i18n'
import { ANILIST_SEARCH_RESULT_LIMIT, ANILIST_SOURCE_ID } from '../utils/constants'
import { AnilistExtensionError } from '../utils/errors'
import { parseFuzzyDate } from './format/dates'
import { selectMediaTitles } from './format/names'
import { buildMediaExternalIds } from './format/sites'
import {
  ANILIST_KIND_FILTERS,
  mapAnimeFormat,
  mapComicFormat,
  type AnilistMediaKind
} from './kinds'
import type { AnilistRuntime } from './runtime'
import { createRequestContext } from './runtime'
import {
  createAnilistAnimeSession,
  createAnilistComicSession,
  createAnilistNovelSession
} from './session'

const MEDIA_SLOTS = [
  'search',
  'info',
  'tags',
  'characters',
  'persons',
  'relatedEntries',
  'covers',
  'backdrops'
] as const

interface SearchCore {
  id: string
  name: string
  originalName?: string | undefined
  releaseDate?: PartialDate | undefined
  externalIds: ExternalId[]
}

abstract class AnilistMediaProviderBase {
  public readonly id = ANILIST_SOURCE_ID
  public readonly name = 'AniList'
  public readonly externalIdSource = ANILIST_SOURCE_ID

  protected abstract readonly kind: AnilistMediaKind

  constructor(protected readonly runtime: AnilistRuntime) {}

  protected async searchItems(
    query: string,
    ctx: ScraperProviderContext
  ): Promise<{ item: AnilistMediaSearchItem; core: SearchCore }[]> {
    const [settings, items] = await Promise.all([
      this.runtime.getSettings(),
      this.runtime.client.searchMedia(
        query,
        ANILIST_KIND_FILTERS[this.kind],
        ANILIST_SEARCH_RESULT_LIMIT,
        { signal: ctx.signal }
      )
    ])

    const results: { item: AnilistMediaSearchItem; core: SearchCore }[] = []
    for (const item of items) {
      const titles = selectMediaTitles(item.title, undefined, {
        locale: ctx.locale,
        preferRomaji: settings.naming.preferRomajiTitles
      })
      if (!titles) {
        continue
      }

      results.push({
        item,
        core: {
          id: String(item.id),
          name: titles.name,
          originalName: titles.originalName,
          releaseDate: parseFuzzyDate(item.startDate),
          externalIds: buildMediaExternalIds(item.id, item.idMal)
        }
      })
    }

    return results
  }

  protected async resolveTarget(
    lookup: AnimeScraperLookup | ComicScraperLookup | NovelScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const known = findKnownAnilistId(lookup)
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
    const id = parseAnilistId(target.id)
    if (id === null) {
      throw new AnilistExtensionError(
        'entry_id_invalid',
        m().errors.idInvalid({ value: target.id })
      )
    }
    return id
  }

  private toTarget(id: number, resolveName: string): IdResolvedTarget {
    return {
      id: String(id),
      cacheKey: `anilist:${this.kind}:${id}`,
      resolveName,
      identity: { externalIds: buildMediaExternalIds(id, undefined) }
    }
  }
}

export class AnilistAnimeProvider extends AnilistMediaProviderBase implements AnimeScraperProvider {
  public readonly capabilities = [...MEDIA_SLOTS, 'companies'] as const
  protected readonly kind = 'anime' as const

  async search(query: string, ctx: ScraperProviderContext): Promise<AnimeSearchResult[]> {
    const results = await this.searchItems(query, ctx)
    return results.map(({ item, core }) => ({ ...core, format: mapAnimeFormat(item.format) }))
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
    const sessionCtx = await createRequestContext(this.runtime, ctx.locale)
    return createAnilistAnimeSession(
      this.runtime.client,
      this.requireMediaId(target),
      sessionCtx,
      ctx.signal
    )
  }
}

export class AnilistComicProvider extends AnilistMediaProviderBase implements ComicScraperProvider {
  public readonly capabilities = MEDIA_SLOTS
  protected readonly kind = 'comic' as const

  async search(query: string, ctx: ScraperProviderContext): Promise<ComicSearchResult[]> {
    const results = await this.searchItems(query, ctx)
    return results.map(({ item, core }) => ({
      ...core,
      format: mapComicFormat(item.countryOfOrigin)
    }))
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
    const sessionCtx = await createRequestContext(this.runtime, ctx.locale)
    return createAnilistComicSession(
      this.runtime.client,
      this.requireMediaId(target),
      sessionCtx,
      ctx.signal
    )
  }
}

export class AnilistNovelProvider extends AnilistMediaProviderBase implements NovelScraperProvider {
  public readonly capabilities = MEDIA_SLOTS
  protected readonly kind = 'novel' as const

  async search(query: string, ctx: ScraperProviderContext): Promise<NovelSearchResult[]> {
    const results = await this.searchItems(query, ctx)
    return results.map(({ core }) => ({ ...core, format: 'lightNovel' as const }))
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
    const sessionCtx = await createRequestContext(this.runtime, ctx.locale)
    return createAnilistNovelSession(
      this.runtime.client,
      this.requireMediaId(target),
      sessionCtx,
      ctx.signal
    )
  }
}
