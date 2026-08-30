import type {
  IdResolvedTarget,
  PersonScraperProvider,
  PersonScraperSession,
  PersonSearchResult,
  ScraperLookup,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import { findKnownTmdbNumericId, parseTmdbNumericId } from '../../identity/lookup'
import { toResolvedTarget } from '../../identity/target'
import { m } from '../../i18n'
import { TMDB_SOURCE_ID } from '../../utils/constants'
import { TmdbExtensionError } from '../../utils/errors'
import { toTmdbLanguage } from '../format/languages'
import { trimToUndefined } from '../format/text'
import { createRequestContext, type TmdbRuntime } from '../runtime'
import { createTmdbPersonSession } from './session'

const SEARCH_RESULT_LIMIT = 20

export class TmdbPersonProvider implements PersonScraperProvider {
  public readonly id = TMDB_SOURCE_ID
  public readonly name = 'TMDB'
  public readonly externalIdSource = TMDB_SOURCE_ID
  public readonly capabilities = ['search', 'info', 'photos'] as const

  constructor(private readonly runtime: TmdbRuntime) {}

  async search(query: string, ctx: ScraperProviderContext): Promise<PersonSearchResult[]> {
    const keyword = query.trim()
    if (!keyword) {
      return []
    }

    const settings = await this.runtime.getSettings()
    const page = await this.runtime.client.searchPeople(keyword, {
      language: toTmdbLanguage(ctx.locale),
      includeAdult: settings.search.includeAdult,
      signal: ctx.signal
    })

    return (page.results ?? []).slice(0, SEARCH_RESULT_LIMIT).map((person) => {
      const originalName = trimToUndefined(person.original_name)
      // Not user-facing copy: guards a malformed row from entering the library
      // without a name.
      const name = trimToUndefined(person.name) ?? originalName ?? `TMDB ${person.id}`

      return {
        id: String(person.id),
        name,
        originalName: originalName !== name ? originalName : undefined,
        externalIds: [{ source: TMDB_SOURCE_ID, id: String(person.id) }]
      }
    })
  }

  async resolve(
    lookup: ScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const known = findKnownTmdbNumericId(lookup)
    if (known !== null) {
      return toResolvedTarget(String(known), lookup.name)
    }

    const first = (await this.search(lookup.name, ctx))[0]
    return first
      ? toResolvedTarget(first.id, first.originalName ?? first.name, first.externalIds)
      : null
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<PersonScraperSession> {
    const personId = parseTmdbNumericId(target.id)
    if (personId === null) {
      throw new TmdbExtensionError('subject_id_invalid', m().errors.idInvalid({ value: target.id }))
    }

    return createTmdbPersonSession(
      this.runtime.client,
      personId,
      await createRequestContext(this.runtime, ctx.locale, ctx.signal)
    )
  }
}
