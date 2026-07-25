import type {
  GameScraperProvider,
  GameScraperSession,
  GameSearchResult,
  IdResolvedTarget,
  ContentLocale,
  ScrapedEntityIdentity,
  ScraperLookup
} from '@kisaki3/extension-sdk'
import type { BangumiClient } from '../../../api/client'
import { BANGUMI_SOURCE_ID, BANGUMI_SUBJECT_TYPE_GAME } from '../../../utils/constants'
import { omitUndefined } from '../../../utils/object'
import { parseBangumiSubjectDate } from './format/dates'
import { parseBangumiId } from './format/ids'
import { resolveLocalizedSubjectName } from './format/names'
import { normalizeKeyText } from './format/text'
import { createBangumiGameSession } from './session'

export class BangumiProvider implements GameScraperProvider {
  public readonly id = BANGUMI_SOURCE_ID
  public readonly externalIdSource = BANGUMI_SOURCE_ID
  public readonly name = 'Bangumi'
  public readonly capabilities = [
    'search',
    'info',
    'tags',
    'characters',
    'persons',
    'companies',
    'covers',
    'backdrops',
    'icons'
  ] as const

  constructor(private readonly client: BangumiClient) {}

  async search(query: string, locale?: ContentLocale): Promise<GameSearchResult[]> {
    const keyword = query.trim()
    if (!keyword) return []

    const page = await this.client.searchGameSubjects(
      {
        keyword,
        sort: 'match',
        filter: {
          type: [BANGUMI_SUBJECT_TYPE_GAME]
        }
      },
      { limit: 25, offset: 0 }
    )

    return page.items
      .filter((subject) => subject.type === BANGUMI_SUBJECT_TYPE_GAME)
      .map((subject) => {
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
          externalIds: [{ source: this.externalIdSource, id: String(subject.id) }]
        })
      })
  }

  async resolve(lookup: ScraperLookup, locale: ContentLocale): Promise<IdResolvedTarget | null> {
    const knownTarget = this.resolveKnownTarget(lookup)
    if (knownTarget) {
      return knownTarget
    }

    const first = (await this.search(lookup.name, locale))[0]
    return first
      ? this.createResolvedTarget(first.id, first.originalName, { externalIds: first.externalIds })
      : null
  }

  async openSession(target: IdResolvedTarget, locale: ContentLocale): Promise<GameScraperSession> {
    return createBangumiGameSession({
      client: this.client,
      target,
      locale
    })
  }

  private resolveKnownTarget(lookup: ScraperLookup): IdResolvedTarget | null {
    const knownId = this.findKnownSubjectId(lookup)
    return knownId ? this.createResolvedTarget(knownId, lookup.name) : null
  }

  private createResolvedTarget(
    id: string,
    resolveName?: string,
    identity?: ScrapedEntityIdentity
  ): IdResolvedTarget {
    const normalizedId = id.trim()

    return omitUndefined({
      id: normalizedId,
      cacheKey: normalizedId,
      resolveName: resolveName?.trim() || undefined,
      identity
    })
  }

  private findKnownSubjectId(lookup: ScraperLookup): string | undefined {
    const normalizedExternalIdSource = normalizeKeyText(this.externalIdSource)

    for (const externalId of lookup.knownIds ?? []) {
      if (normalizeKeyText(externalId.source) !== normalizedExternalIdSource) {
        continue
      }

      try {
        return String(parseBangumiId(externalId.id))
      } catch {
        continue
      }
    }

    return undefined
  }
}
