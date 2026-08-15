import { normalizeExternalIds } from '@shared/identity'
import type { CoreCompanyMetadata } from '@shared/metadata'
import type { ScrapedCompanyBundle, ScraperLookup } from '@shared/scraper'
import type { CompanyIncomingBuildResult } from '../types'
import {
  normalizeOptionalString,
  normalizeExternalSites,
  normalizeTags,
  normalizeUrlCandidates
} from '../shared/normalization'

function buildCompanyCore(
  bundle: ScrapedCompanyBundle | null,
  lookup: ScraperLookup
): Partial<CoreCompanyMetadata> {
  const core: Partial<CoreCompanyMetadata> = {}
  const bundleCore = bundle?.core

  const name = normalizeOptionalString(bundleCore?.name)
  if (name) core.name = name

  const originalName = normalizeOptionalString(bundleCore?.originalName)
  if (originalName) core.originalName = originalName

  if (bundleCore?.foundedDate) core.foundedDate = bundleCore.foundedDate

  const description = normalizeOptionalString(bundleCore?.description)
  if (description) core.description = description

  const externalSites = normalizeExternalSites(bundleCore?.externalSites)
  if (externalSites) core.externalSites = externalSites

  const identityIds = bundle?.identity.externalIds
  if (identityIds || lookup.knownIds) {
    core.externalIds = normalizeExternalIds([...(identityIds ?? []), ...(lookup.knownIds ?? [])])
  }

  const tags = normalizeTags(bundleCore?.tags)
  if (tags) core.tags = tags

  return core
}

export function buildCompanyIncoming(
  bundle: ScrapedCompanyBundle | null,
  lookup: ScraperLookup
): CompanyIncomingBuildResult {
  const core = buildCompanyCore(bundle, lookup)
  const logoUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.logoUrls)

  // A surface is available when the scraper spoke about it at all; an empty
  // collection is an authoritative "none", not a missing answer.
  const availability: CompanyIncomingBuildResult['availability'] = {
    surfaces: new Set()
  }

  if (core.name) availability.surfaces.add('name')
  if (core.originalName) availability.surfaces.add('originalName')
  if (core.foundedDate) availability.surfaces.add('foundedDate')
  if (core.description) availability.surfaces.add('description')
  if (core.externalSites) availability.surfaces.add('externalSites')
  if (core.externalIds) availability.surfaces.add('externalIds')
  if (core.tags) availability.surfaces.add('tags')
  if (logoUrls) availability.surfaces.add('logos')

  return {
    incoming: {
      core,
      relationFacts: {},
      mediaCandidates: logoUrls ? { logoUrls } : {}
    },
    availability
  }
}
