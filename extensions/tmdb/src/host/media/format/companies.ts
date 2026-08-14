import type { ScrapedAnimeCompanyFact, ScrapedTag } from '@kisaki3/extension-sdk'
import type { TmdbCompanySummary } from '../../api/types'
import { TMDB_SOURCE_ID } from '../../utils/constants'
import { omitUndefined } from '../../utils/object'
import { buildImageUrl } from './images'
import { mapTmdbCompanyRole } from './roles'
import { buildExternalSites, tmdbCompanyUrl, tmdbSite } from './sites'
import { trimToUndefined } from './text'

/** Tag annotations are source vocabulary, not translatable copy. */
const COUNTRY_TAG_NOTE = 'Country'
const NETWORK_NOTE = 'Network'

/**
 * Production companies and networks as library company facts.
 *
 * A company credited both ways keeps its first credit, which is the production
 * one: making the show is the stronger statement.
 */
export function buildAnimeCompanyFacts(
  production: readonly TmdbCompanySummary[] | undefined,
  networks: readonly TmdbCompanySummary[] | undefined,
  imageBaseUrl: string
): ScrapedAnimeCompanyFact[] {
  const facts = new Map<number, ScrapedAnimeCompanyFact>()

  for (const company of production ?? []) {
    if (!facts.has(company.id)) {
      facts.set(company.id, toCompanyFact(company, 'production', imageBaseUrl))
    }
  }

  for (const network of networks ?? []) {
    if (!facts.has(network.id)) {
      facts.set(network.id, toCompanyFact(network, 'network', imageBaseUrl))
    }
  }

  return [...facts.values()]
}

function toCompanyFact(
  company: TmdbCompanySummary,
  kind: 'production' | 'network',
  imageBaseUrl: string
): ScrapedAnimeCompanyFact {
  const logo = buildImageUrl(imageBaseUrl, company.logo_path)
  const tags = buildCountryTags(company.origin_country)

  return {
    ...omitUndefined({
      // Not user-facing copy: guards a malformed company row from entering the
      // library without a name.
      name: trimToUndefined(company.name) ?? `TMDB ${company.id}`,
      externalSites: buildExternalSites([tmdbSite(tmdbCompanyUrl(company.id))]),
      logos: logo ? [logo] : undefined,
      tags: tags.length > 0 ? tags : undefined,
      note: kind === 'network' ? NETWORK_NOTE : undefined
    }),
    identity: { externalIds: [{ source: TMDB_SOURCE_ID, id: String(company.id) }] },
    role: mapTmdbCompanyRole(kind)
  }
}

export function buildCountryTags(originCountry: string | null | undefined): ScrapedTag[] {
  const country = trimToUndefined(originCountry)
  return country ? [{ name: country, note: COUNTRY_TAG_NOTE }] : []
}
