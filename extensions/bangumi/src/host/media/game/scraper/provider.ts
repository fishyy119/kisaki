import type {
  ContentLocale,
  GameScraperProvider,
  GameScraperSession,
  GameSearchResult,
  IdResolvedTarget,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import type { BangumiSubject } from '../../../api/types'
import { parseBangumiSubjectDate } from '../../format/dates'
import { resolveLocalizedSubjectName } from '../../format/names'
import { BangumiSubjectProvider } from '../../subject/provider'
import { createBangumiGameSession } from './session'

export class BangumiGameProvider
  extends BangumiSubjectProvider<GameSearchResult>
  implements GameScraperProvider
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
    'backdrops',
    'icons'
  ] as const

  protected readonly scope = 'game' as const

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<GameScraperSession> {
    return createBangumiGameSession({
      client: this.client,
      target,
      locale: ctx.locale,
      signal: ctx.signal
    })
  }

  protected toSearchResult(subject: BangumiSubject, locale: ContentLocale): GameSearchResult {
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
      externalIds: this.buildSearchExternalIds(subject)
    }
  }
}
