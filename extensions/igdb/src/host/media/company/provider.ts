import type {
  CompanyScraperProvider,
  CompanyScraperSession,
  CompanySearchResult,
  IdResolvedTarget,
  ScraperLookup,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import { escapeApicalypseString } from '../../api/client'
import type { IgdbCompany, IgdbImageRow, IgdbWebsite, IgdbWebsiteType } from '../../api/types'
import { parseIgdbEntryId } from '../../identity/entry-id'
import { findKnownIgdbId } from '../../identity/lookup'
import { toResolvedTarget } from '../../identity/target'
import { m } from '../../i18n'
import { IGDB_SEARCH_RESULT_LIMIT } from '../../utils/constants'
import { IgdbExtensionError } from '../../utils/errors'
import { indexById, indexNames } from '../../utils/object'
import { buildCompanyFacts } from '../satellites'
import {
  COMPANY_FIELDS,
  COMPANY_SEARCH_FIELDS,
  IMAGE_FIELDS,
  WEBSITE_FIELDS,
  WEBSITE_TYPE_FIELDS
} from '../fields'
import { toIgdbExternalId } from '../format/sites'
import type { IgdbRuntime } from '../runtime'
import { createSatelliteSession } from '../satellite-session'

export class IgdbCompanyProvider implements CompanyScraperProvider {
  public readonly id = 'igdb'
  public readonly name = 'IGDB'
  public readonly externalIdSource = 'igdb'
  public readonly capabilities = ['search', 'info', 'logos'] as const

  constructor(private readonly runtime: IgdbRuntime) {}

  async search(query: string, ctx: ScraperProviderContext): Promise<CompanySearchResult[]> {
    const keyword = escapeApicalypseString(query.trim())
    if (!keyword) {
      return []
    }

    const rows = await this.runtime.client.query<IgdbCompany>(
      'companies',
      `fields ${COMPANY_SEARCH_FIELDS}; search "${keyword}"; limit ${IGDB_SEARCH_RESULT_LIMIT};`,
      { signal: ctx.signal }
    )

    return rows.map((company) => ({
      id: String(company.id),
      // Not user-facing copy: guards a malformed row from entering the
      // library without a name.
      name: company.name?.trim() || `IGDB ${company.id}`,
      externalIds: [toIgdbExternalId(company.id)]
    }))
  }

  async resolve(
    lookup: ScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const known = findKnownIgdbId(lookup)
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
    const companyId = parseIgdbEntryId(target.id)
    if (companyId === null) {
      throw new IgdbExtensionError('entry_id_invalid', m().errors.idInvalid({ value: target.id }))
    }

    const client = this.runtime.client
    const request = { signal: ctx.signal }

    return createSatelliteSession({
      imageSlot: 'logos',
      loadFacts: async () => {
        const [company] = await client.queryByIds<IgdbCompany>(
          'companies',
          [companyId],
          COMPANY_FIELDS,
          request
        )
        if (!company) {
          throw new IgdbExtensionError('igdb_not_found', m().errors.notFound)
        }

        const [logos, websites] = await Promise.all([
          client.queryByIds<IgdbImageRow>('company_logos', [company.logo], IMAGE_FIELDS, request),
          client.queryByIds<IgdbWebsite>(
            'company_websites',
            company.websites ?? [],
            WEBSITE_FIELDS,
            request
          )
        ])
        const websiteTypes = await client.queryByIds<IgdbWebsiteType>(
          'website_types',
          websites.map((site) => site.type),
          WEBSITE_TYPE_FIELDS,
          request
        )

        return buildCompanyFacts(company, {
          logos: indexById(logos),
          websites: indexById(websites),
          websiteTypes: indexNames(websiteTypes, (type) => type.type)
        })
      }
    })
  }
}
