import type {
  CompanyScraperProvider,
  CompanyScraperSession,
  CompanySearchResult,
  IdResolvedTarget,
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
import { createTmdbCompanySession } from './session'

const SEARCH_RESULT_LIMIT = 20

export class TmdbCompanyProvider implements CompanyScraperProvider {
  public readonly id = TMDB_SOURCE_ID
  public readonly name = 'TMDB'
  public readonly externalIdSource = TMDB_SOURCE_ID
  public readonly capabilities = ['search', 'info', 'tags', 'logos'] as const

  constructor(private readonly runtime: TmdbRuntime) {}

  async search(query: string, ctx: ScraperProviderContext): Promise<CompanySearchResult[]> {
    const keyword = query.trim()
    if (!keyword) {
      return []
    }

    const page = await this.runtime.client.searchCompanies(keyword, {
      language: toTmdbLanguage(ctx.locale),
      signal: ctx.signal
    })

    return (page.results ?? []).slice(0, SEARCH_RESULT_LIMIT).map((company) => ({
      id: String(company.id),
      // Not user-facing copy: guards a malformed row from entering the library
      // without a name.
      name: trimToUndefined(company.name) ?? `TMDB ${company.id}`,
      externalIds: [{ source: TMDB_SOURCE_ID, id: String(company.id) }]
    }))
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
    return first ? toResolvedTarget(first.id, first.name, first.externalIds) : null
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<CompanyScraperSession> {
    const companyId = parseTmdbNumericId(target.id)
    if (companyId === null) {
      throw new TmdbExtensionError('subject_id_invalid', m().errors.idInvalid({ value: target.id }))
    }

    return createTmdbCompanySession(
      this.runtime.client,
      companyId,
      await createRequestContext(this.runtime, ctx.locale, ctx.signal)
    )
  }
}
