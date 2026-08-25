import type {
  ComicScraperProvider,
  ComicScraperSession,
  ComicSearchResult,
  ContentLocale,
  IdResolvedTarget,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import type { BangumiSubject } from '../../../api/types'
import { omitUndefined } from '../../../utils/object'
import { parseBangumiSubjectDate } from '../../format/dates'
import {
  mapBangumiComicFormat,
  resolveBangumiBookKind,
  type BangumiBookKind
} from '../../format/formats'
import { resolveLocalizedSubjectName } from '../../format/names'
import { BangumiSubjectProvider } from '../../subject/provider'
import { createBangumiComicSession } from './session'

/** Search result plus the platform fact the comic/novel split filters on. */
type ComicCandidate = ComicSearchResult & { bookKind?: BangumiBookKind }

export class BangumiComicProvider
  extends BangumiSubjectProvider<ComicCandidate>
  implements ComicScraperProvider
{
  public readonly capabilities = [
    'search',
    'info',
    'tags',
    'characters',
    'persons',
    'companies',
    'relatedEntries',
    'covers',
    'backdrops'
  ] as const

  protected readonly scope = 'book' as const

  /**
   * Book search spans comics, novels, and art books, so novel-labelled entries
   * drop out here. Unlabelled entries stay in reach of both book providers;
   * art books stay in reach of neither, and reaching one is a manual choice.
   */
  override async search(query: string, ctx: ScraperProviderContext): Promise<ComicSearchResult[]> {
    const results = await super.search(query, ctx)
    return results
      .filter((result) => result.bookKind !== 'novel')
      .map(({ bookKind: _bookKind, ...rest }) => rest)
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<ComicScraperSession> {
    return createBangumiComicSession({
      client: this.client,
      target,
      locale: ctx.locale,
      signal: ctx.signal
    })
  }

  protected toSearchResult(subject: BangumiSubject, locale: ContentLocale): ComicCandidate {
    const { name, originalName } = resolveLocalizedSubjectName(
      subject.name,
      subject.name_cn,
      locale
    )

    return omitUndefined({
      id: String(subject.id),
      name,
      originalName,
      releaseDate: parseBangumiSubjectDate(subject.date),
      format: mapBangumiComicFormat(subject.platform),
      externalIds: this.buildSearchExternalIds(subject),
      bookKind: resolveBangumiBookKind(subject.platform)
    })
  }
}
