import type {
  AnimeScraperProvider,
  AnimeScraperSession,
  AnimeSearchResult,
  ContentLocale,
  IdResolvedTarget,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import type { BangumiSubject } from '../../../api/types'
import { parseBangumiSubjectDate } from '../../format/dates'
import { mapBangumiAnimeFormat } from '../../format/formats'
import { resolveLocalizedSubjectName } from '../../format/names'
import { BangumiSubjectProvider } from '../../subject/provider'
import { createBangumiAnimeSession } from './session'

export class BangumiAnimeProvider
  extends BangumiSubjectProvider<AnimeSearchResult>
  implements AnimeScraperProvider
{
  public readonly capabilities = [
    'search',
    'info',
    'tags',
    'episodes',
    'characters',
    'persons',
    'companies',
    'relatedEntries',
    'covers',
    'backdrops'
  ] as const

  protected readonly scope = 'anime' as const

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<AnimeScraperSession> {
    return createBangumiAnimeSession({
      client: this.client,
      target,
      locale: ctx.locale,
      signal: ctx.signal
    })
  }

  protected toSearchResult(subject: BangumiSubject, locale: ContentLocale): AnimeSearchResult {
    const { name, originalName } = resolveLocalizedSubjectName(
      subject.name,
      subject.name_cn,
      locale
    )

    return {
      id: String(subject.id),
      name,
      originalName,
      releaseDate: parseBangumiSubjectDate(subject.date),
      format: mapBangumiAnimeFormat(subject.platform),
      externalIds: this.buildSearchExternalIds(subject)
    }
  }
}
