import type {
  ContentLocale,
  IdResolvedTarget,
  NovelScraperProvider,
  NovelScraperSession,
  NovelSearchResult,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import type { BangumiSubject } from '../../../api/types'
import { omitUndefined } from '../../../utils/object'
import { parseBangumiSubjectDate } from '../../format/dates'
import {
  resolveBangumiBookGrain,
  resolveBangumiBookKind,
  resolveBangumiNovelFormat,
  type BangumiBookKind
} from '../../format/formats'
import { resolveLocalizedSubjectName } from '../../format/names'
import { BangumiSubjectProvider } from '../../subject/provider'
import { createBangumiNovelSession } from './session'

/** Search result plus the platform fact the comic/novel split filters on. */
type NovelCandidate = NovelSearchResult & { bookKind?: BangumiBookKind }

export class BangumiNovelProvider
  extends BangumiSubjectProvider<NovelCandidate>
  implements NovelScraperProvider
{
  public readonly capabilities = [
    'search',
    'info',
    'tags',
    'volumes',
    'characters',
    'persons',
    'companies',
    'relatedEntries',
    'covers',
    'backdrops'
  ] as const

  protected readonly scope = 'book' as const

  /**
   * Book search spans comics, novels, and art books, so comic-labelled entries
   * drop out here. Unlabelled entries stay in reach of both book providers;
   * art books stay in reach of neither, and reaching one is a manual choice.
   */
  override async search(query: string, ctx: ScraperProviderContext): Promise<NovelSearchResult[]> {
    const results = await super.search(query, ctx)
    return results
      .filter((result) => result.bookKind !== 'comic')
      .map(({ bookKind: _bookKind, ...rest }) => rest)
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<NovelScraperSession> {
    return createBangumiNovelSession({
      client: this.client,
      target,
      locale: ctx.locale,
      signal: ctx.signal
    })
  }

  protected toSearchResult(subject: BangumiSubject, locale: ContentLocale): NovelCandidate {
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
      format: resolveBangumiNovelFormat(subject),
      grain: resolveBangumiBookGrain(subject.series),
      externalIds: this.buildSearchExternalIds(subject),
      bookKind: resolveBangumiBookKind(subject.platform)
    })
  }
}
