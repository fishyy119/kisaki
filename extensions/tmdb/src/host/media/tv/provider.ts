import type {
  IdResolvedTarget,
  ScraperLookup,
  ScraperProviderContext,
  TvScraperLookup,
  TvScraperProvider,
  TvScraperSession,
  TvSearchResult
} from '@kisaki3/extension-sdk'
import { formatTmdbSubjectId } from '../../identity/subject-id'
import { readKnownTmdbIds } from '../../identity/lookup'
import { toResolvedTarget } from '../../identity/target'
import { m } from '../../i18n'
import { TMDB_SOURCE_ID } from '../../utils/constants'
import { TmdbExtensionError } from '../../utils/errors'
import { selectTmdbCandidate } from '../candidates'
import { toTmdbLanguage } from '../format/languages'
import { createRequestContext, type TmdbRuntime } from '../runtime'
import { readTmdbSeriesRef, type TmdbSeriesRef } from './reference'
import { searchTmdbTv } from './search'
import { createTmdbTvSession } from './session'

export class TmdbTvProvider implements TvScraperProvider {
  public readonly id = TMDB_SOURCE_ID
  public readonly name = 'TMDB'
  public readonly externalIdSource = TMDB_SOURCE_ID
  /**
   * No `characters`: TMDB has no character entity, and a cast credit alone
   * cannot name the character it belongs to. No `relatedEntries` either: TMDB
   * never states a relation between two shows.
   */
  public readonly capabilities = [
    'search',
    'info',
    'tags',
    'seasons',
    'episodes',
    'persons',
    'companies',
    'covers',
    'backdrops',
    'logos'
  ] as const

  constructor(private readonly runtime: TmdbRuntime) {}

  async search(query: string, ctx: ScraperProviderContext): Promise<TvSearchResult[]> {
    const settings = await this.runtime.getSettings()

    return searchTmdbTv(this.runtime.client, query, {
      language: toTmdbLanguage(ctx.locale),
      includeAdult: settings.search.includeAdult,
      signal: ctx.signal
    })
  }

  async resolve(
    lookup: TvScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const known = this.findKnownRef(lookup)
    if (known) {
      return toResolvedTarget(formatTmdbSubjectId(known), lookup.name)
    }

    const picked = selectTmdbCandidate(await this.search(lookup.name, ctx), lookup)
    return picked
      ? toResolvedTarget(picked.id, picked.originalName ?? picked.name, picked.externalIds)
      : null
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<TvScraperSession> {
    const ref = readTmdbSeriesRef(target.id)
    if (!ref) {
      throw new TmdbExtensionError(
        'subject_id_invalid',
        m().errors.referenceInvalid({ value: target.id })
      )
    }

    const requestContext = await createRequestContext(this.runtime, ctx.locale, ctx.signal)
    return createTmdbTvSession(this.runtime.client, ref, requestContext)
  }

  private findKnownRef(lookup: ScraperLookup): TmdbSeriesRef | null {
    for (const id of readKnownTmdbIds(lookup)) {
      const ref = readTmdbSeriesRef(id)
      if (ref) {
        return ref
      }
    }

    return null
  }
}
