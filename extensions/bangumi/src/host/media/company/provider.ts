import type {
  CompanyScraperProvider,
  CompanyScraperSession,
  CompanySearchResult,
  IdResolvedTarget,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import { buildCompanyFacts } from '../satellites'
import {
  BangumiSatelliteProvider,
  SATELLITE_SEARCH_RESULT_LIMIT,
  type SatelliteSearchResult
} from '../satellite-provider'
import { createSatelliteSession } from '../satellite-session'
import { isBangumiCompanyType } from '../person-types'
import { fetchPersonDetails } from '../subject/people'

/**
 * Scrapes a company from its own Bangumi entry.
 *
 * Bangumi has no separate company entity: studios, publishers, and circles are
 * person entries of the company and group types, so the search keeps those and
 * the person provider takes the individuals.
 */
export class BangumiCompanyProvider
  extends BangumiSatelliteProvider<CompanySearchResult & SatelliteSearchResult>
  implements CompanyScraperProvider
{
  public readonly capabilities = ['search', 'info', 'tags', 'logos'] as const

  async search(
    query: string,
    ctx: ScraperProviderContext
  ): Promise<(CompanySearchResult & SatelliteSearchResult)[]> {
    const keyword = query.trim()
    if (!keyword) {
      return []
    }

    const page = await this.client.searchPersons(
      keyword,
      { limit: SATELLITE_SEARCH_RESULT_LIMIT, offset: 0 },
      { signal: ctx.signal }
    )

    return page.items
      .filter((person) => isBangumiCompanyType(person.type))
      .map((company) => ({
        id: String(company.id),
        name: company.name,
        externalIds: [{ source: this.externalIdSource, id: String(company.id) }]
      }))
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<CompanyScraperSession> {
    const companyId = this.requireSatelliteId(target.id)
    const client = this.client

    return createSatelliteSession({
      imageSlot: 'logos',
      loadFacts: async () => {
        const details = await fetchPersonDetails(client, [companyId], ctx.signal)
        return buildCompanyFacts(companyId, details.get(companyId), undefined, ctx.locale)
      }
    })
  }
}
