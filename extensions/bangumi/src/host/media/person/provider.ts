import type {
  IdResolvedTarget,
  PersonScraperProvider,
  PersonScraperSession,
  PersonSearchResult,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import { buildPersonFacts } from '../satellites'
import {
  BangumiSatelliteProvider,
  SATELLITE_SEARCH_RESULT_LIMIT,
  type SatelliteSearchResult
} from '../satellite-provider'
import { createSatelliteSession } from '../satellite-session'
import { BANGUMI_INDIVIDUAL_PERSON_TYPE } from '../person-types'
import { fetchPersonDetails } from '../subject/people'

/**
 * Scrapes a person from their own Bangumi entry.
 *
 * Bangumi files companies in the same numbering space as people, so the search
 * keeps only individuals; the company provider takes the rest.
 */
export class BangumiPersonProvider
  extends BangumiSatelliteProvider<PersonSearchResult & SatelliteSearchResult>
  implements PersonScraperProvider
{
  public readonly capabilities = ['search', 'info', 'tags', 'photos'] as const

  async search(
    query: string,
    ctx: ScraperProviderContext
  ): Promise<(PersonSearchResult & SatelliteSearchResult)[]> {
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
      .filter((person) => person.type === BANGUMI_INDIVIDUAL_PERSON_TYPE)
      .map((person) => ({
        id: String(person.id),
        name: person.name,
        externalIds: [{ source: this.externalIdSource, id: String(person.id) }]
      }))
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<PersonScraperSession> {
    const personId = this.requireSatelliteId(target.id)
    const client = this.client

    return createSatelliteSession({
      imageSlot: 'photos',
      loadFacts: async () => {
        const details = await fetchPersonDetails(client, [personId], ctx.signal)
        return buildPersonFacts(personId, details.get(personId), undefined, ctx.locale)
      }
    })
  }
}
