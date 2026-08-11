import type {
  ContentLocale,
  ExternalId,
  IdResolvedTarget,
  ScrapedEntityIdentity,
  ScraperLookup,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import type { BangumiClient } from '../../api/client'
import type { BangumiSubject } from '../../api/types'
import { BANGUMI_SOURCE_ID } from '../../utils/constants'
import { omitUndefined } from '../../utils/object'
import { parseBangumiId } from '../format/ids'
import { normalizeKeyText } from '../format/text'
import { getBangumiSubjectType, type BangumiMediaScope } from '../../../shared/scopes'

const SEARCH_RESULT_LIMIT = 25

interface SubjectSearchResult {
  id: string
  name: string
  originalName?: string
  externalIds: readonly ExternalId[]
}

/**
 * Search and identity resolution shared by every Bangumi scraper provider.
 *
 * Subclasses only declare their media scope and how a subject becomes their
 * scope-specific search result and session.
 */
export abstract class BangumiSubjectProvider<TSearchResult extends SubjectSearchResult> {
  public readonly id = BANGUMI_SOURCE_ID
  public readonly externalIdSource = BANGUMI_SOURCE_ID
  public readonly name = 'Bangumi'

  protected abstract readonly scope: BangumiMediaScope

  constructor(protected readonly client: BangumiClient) {}

  async search(query: string, ctx: ScraperProviderContext): Promise<TSearchResult[]> {
    const keyword = query.trim()
    if (!keyword) return []

    const subjectType = getBangumiSubjectType(this.scope)
    const page = await this.client.searchSubjects(
      this.scope,
      { keyword, sort: 'match' },
      { limit: SEARCH_RESULT_LIMIT, offset: 0 },
      { signal: ctx.signal }
    )

    return page.items
      .filter((subject) => subject.type === subjectType)
      .map((subject) => this.toSearchResult(subject, ctx.locale))
  }

  async resolve(
    lookup: ScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const knownId = this.findKnownSubjectId(lookup)
    if (knownId) {
      return this.createResolvedTarget(knownId, lookup.name)
    }

    const first = (await this.search(lookup.name, ctx))[0]
    return first
      ? this.createResolvedTarget(first.id, first.originalName ?? first.name, {
          externalIds: first.externalIds
        })
      : null
  }

  protected abstract toSearchResult(subject: BangumiSubject, locale: ContentLocale): TSearchResult

  protected buildSearchExternalIds(subject: BangumiSubject): ExternalId[] {
    return [{ source: this.externalIdSource, id: String(subject.id) }]
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
