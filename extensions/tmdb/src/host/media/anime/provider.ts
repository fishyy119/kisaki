import type {
  AnimeScraperProvider,
  AnimeScraperSession,
  AnimeSearchResult,
  IdResolvedTarget,
  ScraperLookup,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import {
  formatTmdbSubjectId,
  parseTmdbEntryId,
  type TmdbSubjectRef
} from '../../identity/subject-id'
import { readKnownTmdbIds } from '../../identity/lookup'
import { toResolvedTarget } from '../../identity/target'
import { m } from '../../i18n'
import { TMDB_SOURCE_ID } from '../../utils/constants'
import { TmdbExtensionError } from '../../utils/errors'
import { toTmdbLanguage } from '../format/languages'
import { createRequestContext, type TmdbRuntime } from '../runtime'
import { searchTmdbAnime } from './search'
import { createTmdbAnimeSession } from './session'

export class TmdbAnimeProvider implements AnimeScraperProvider {
  public readonly id = TMDB_SOURCE_ID
  public readonly name = 'TMDB'
  public readonly externalIdSource = TMDB_SOURCE_ID
  /**
   * No `characters`: TMDB has no character entity, and a voice credit alone
   * cannot name the character it belongs to.
   */
  public readonly capabilities = [
    'search',
    'info',
    'tags',
    'episodes',
    'persons',
    'companies',
    'relatedEntries',
    'covers',
    'backdrops',
    'logos'
  ] as const

  constructor(private readonly runtime: TmdbRuntime) {}

  async search(query: string, ctx: ScraperProviderContext): Promise<AnimeSearchResult[]> {
    const settings = await this.runtime.getSettings()

    return searchTmdbAnime(this.runtime.client, query, {
      language: toTmdbLanguage(ctx.locale),
      includeAdult: settings.search.includeAdult,
      signal: ctx.signal
    })
  }

  async resolve(
    lookup: ScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const known = this.findKnownRef(lookup)
    if (known) {
      return toResolvedTarget(formatTmdbSubjectId(known), lookup.name)
    }

    const first = (await this.search(lookup.name, ctx))[0]
    return first
      ? toResolvedTarget(first.id, first.originalName ?? first.name, first.externalIds)
      : null
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<AnimeScraperSession> {
    const ref = parseTmdbEntryId(target.id)
    if (!ref) {
      throw new TmdbExtensionError(
        'subject_id_invalid',
        m().errors.referenceInvalid({ value: target.id })
      )
    }

    const requestContext = await createRequestContext(this.runtime, ctx.locale, ctx.signal)
    return createTmdbAnimeSession(this.runtime.client, ref, requestContext)
  }

  private findKnownRef(lookup: ScraperLookup): TmdbSubjectRef | null {
    for (const id of readKnownTmdbIds(lookup)) {
      const ref = parseTmdbEntryId(id)
      if (ref) {
        return ref
      }
    }

    return null
  }
}
