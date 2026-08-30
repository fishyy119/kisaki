/**
 * Shared entry-to-fact mapping.
 *
 * A company is the same entity whether it is read from its own endpoint or
 * reached through a game's involvement rows. The builder returns the facts
 * split by slot, so the company provider serves them directly and the game
 * provider folds them into one metadata object plus a role.
 */

import type {
  ExternalSite,
  ScrapedCompanyInfo,
  ScrapedCompanyMetadata,
  ScrapedEntityIdentity,
  ScrapedTag
} from '@kisaki3/extension-sdk'
import type { IgdbCompany, IgdbImageRow, IgdbWebsite } from '../api/types'
import { parseUnixDate } from './format/dates'
import { dedupeUrls, resolveImageUrl } from './format/images'
import {
  dedupeExternalSites,
  igdbCompanyUrl,
  igdbSite,
  labelledSite,
  toIgdbExternalId,
  toOptionalSites
} from './format/sites'
import { normalizeDescription, trimToUndefined } from './format/text'

/** One entry's facts, grouped the way the scraper slots ask for them. */
export interface IgdbSatelliteFacts<TInfo> {
  info: TInfo
  identity: ScrapedEntityIdentity
  tags: ScrapedTag[]
  images: string[]
}

/** Reference rows a company's own fields point at. */
export interface IgdbCompanyReferences {
  logos: ReadonlyMap<number, IgdbImageRow>
  websites: ReadonlyMap<number, IgdbWebsite>
  websiteTypes: ReadonlyMap<number, string>
}

export function buildCompanyFacts(
  company: IgdbCompany,
  references: IgdbCompanyReferences
): IgdbSatelliteFacts<ScrapedCompanyInfo> {
  const sites: (ExternalSite | undefined)[] = [igdbSite(company.url, igdbCompanyUrl(company.id))]

  for (const websiteId of company.websites ?? []) {
    const site = references.websites.get(websiteId)
    if (site) {
      sites.push(labelledSite(references.websiteTypes.get(site.type ?? -1), site.url))
    }
  }

  return {
    info: {
      // Not user-facing copy: guards a malformed row from entering the library
      // without a name.
      name: trimToUndefined(company.name) ?? `IGDB ${company.id}`,
      description: normalizeDescription(company.description),
      foundedDate: parseUnixDate(company.start_date),
      externalSites: toOptionalSites(dedupeExternalSites(sites))
    },
    identity: { externalIds: [toIgdbExternalId(company.id)] },
    tags: [],
    images: dedupeUrls([resolveImageUrl(references.logos.get(company.logo ?? -1), 'logo_med')])
  }
}

export function toCompanyMetadata(
  facts: IgdbSatelliteFacts<ScrapedCompanyInfo>
): ScrapedCompanyMetadata {
  return {
    ...facts.info,
    identity: facts.identity,
    tags: facts.tags.length > 0 ? [...facts.tags] : undefined,
    logos: facts.images.length > 0 ? [...facts.images] : undefined
  }
}
