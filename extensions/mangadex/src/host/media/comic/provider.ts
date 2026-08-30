import type {
  ComicScraperLookup,
  ComicScraperProvider,
  ComicScraperSession,
  ComicSearchResult,
  IdResolvedTarget,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import type { MangadexClient } from '../../api/client'
import type { MangadexSettingsV1 } from '../../config/schema'
import { findKnownMangadexId, parseMangadexId } from '../../identity/ids'
import { m } from '../../i18n'
import { MANGADEX_SEARCH_RESULT_LIMIT, MANGADEX_SOURCE_ID } from '../../utils/constants'
import { MangadexExtensionError } from '../../utils/errors'
import { buildComicFormat, buildMangaExternalIds, buildReleaseDate } from '../format/facts'
import { selectMangaTitles } from '../format/titles'
import { createMangadexComicSession } from './session'

export class MangadexComicProvider implements ComicScraperProvider {
  public readonly id = MANGADEX_SOURCE_ID
  public readonly name = 'MangaDex'
  public readonly externalIdSource = MANGADEX_SOURCE_ID
  /**
   * MangaDex states no character, chapter-metadata, company, or landscape-art
   * facts; those slots stay undeclared.
   */
  public readonly capabilities = [
    'search',
    'info',
    'tags',
    'persons',
    'relatedEntries',
    'covers'
  ] as const

  constructor(
    private readonly client: MangadexClient,
    private readonly getSettings: () => Promise<MangadexSettingsV1>
  ) {}

  async search(query: string, ctx: ScraperProviderContext): Promise<ComicSearchResult[]> {
    const keyword = query.trim()
    if (!keyword) {
      return []
    }

    const [settings, items] = await Promise.all([
      this.getSettings(),
      this.client.searchManga(keyword, MANGADEX_SEARCH_RESULT_LIMIT, { signal: ctx.signal })
    ])

    const results: ComicSearchResult[] = []
    for (const manga of items) {
      const titles = selectMangaTitles(manga.attributes, {
        locale: ctx.locale,
        preferRomanized: settings.naming.preferRomanizedTitles
      })
      if (!titles) {
        continue
      }

      results.push({
        id: manga.id,
        name: titles.name,
        originalName: titles.originalName,
        releaseDate: buildReleaseDate(manga.attributes),
        format: buildComicFormat(manga.attributes),
        externalIds: buildMangaExternalIds(manga)
      })
    }

    return results
  }

  async resolve(
    lookup: ComicScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const known = findKnownMangadexId(lookup)
    if (known !== null) {
      return this.toTarget(known, lookup.name)
    }

    const results = await this.search(lookup.name, ctx)
    if (results.length === 0) {
      return null
    }

    // Franchises share names; a stated year separates a work from its sequels.
    const wantedYear = lookup.releaseDate?.year
    const match =
      wantedYear !== undefined
        ? (results.find((entry) => entry.releaseDate?.year === wantedYear) ?? results[0]!)
        : results[0]!

    return this.toTarget(match.id, match.name)
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<ComicScraperSession> {
    const mangaId = parseMangadexId(target.id)
    if (mangaId === null) {
      throw new MangadexExtensionError(
        'entry_id_invalid',
        m().errors.idInvalid({ value: target.id })
      )
    }

    const settings = await this.getSettings()
    return createMangadexComicSession(
      this.client,
      mangaId,
      { locale: ctx.locale, preferRomanized: settings.naming.preferRomanizedTitles },
      ctx.signal
    )
  }

  private toTarget(id: string, resolveName: string): IdResolvedTarget {
    return {
      id,
      cacheKey: `mangadex:comic:${id}`,
      resolveName,
      identity: { externalIds: [{ source: MANGADEX_SOURCE_ID, id }] }
    }
  }
}
