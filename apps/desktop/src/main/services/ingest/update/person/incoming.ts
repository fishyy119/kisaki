import { normalizeExternalIds } from '@shared/identity'
import type { CorePersonMetadata } from '@shared/metadata'
import type { ScrapedPersonBundle, ScraperLookup } from '@shared/scraper'
import type { PersonIncomingBuildResult } from './types'
import {
  normalizeAliases,
  normalizeOptionalString,
  normalizeExternalSites,
  normalizeTags,
  normalizeUrlCandidates
} from '../../normalization'

function buildPersonCore(
  bundle: ScrapedPersonBundle | null,
  lookup: ScraperLookup
): Partial<CorePersonMetadata> {
  const core: Partial<CorePersonMetadata> = {}
  const bundleCore = bundle?.core

  const name = normalizeOptionalString(bundleCore?.name)
  if (name) core.name = name

  const originalName = normalizeOptionalString(bundleCore?.originalName)
  if (originalName) core.originalName = originalName

  const aliases = normalizeAliases(bundleCore?.aliases)
  if (aliases) core.aliases = aliases

  if (bundleCore?.birthDate) core.birthDate = bundleCore.birthDate
  if (bundleCore?.deathDate) core.deathDate = bundleCore.deathDate
  if (bundleCore?.gender) core.gender = bundleCore.gender

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

export function buildPersonIncoming(
  bundle: ScrapedPersonBundle | null,
  lookup: ScraperLookup
): PersonIncomingBuildResult {
  const core = buildPersonCore(bundle, lookup)
  const photoUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.photoUrls)

  // A surface is available when the scraper spoke about it at all; an empty
  // collection is an authoritative "none", not a missing answer.
  const availability: PersonIncomingBuildResult['availability'] = {
    surfaces: new Set()
  }

  if (core.name) availability.surfaces.add('name')
  if (core.originalName) availability.surfaces.add('originalName')
  if (core.aliases) availability.surfaces.add('aliases')
  if (core.birthDate) availability.surfaces.add('birthDate')
  if (core.deathDate) availability.surfaces.add('deathDate')
  if (core.gender) availability.surfaces.add('gender')
  if (core.description) availability.surfaces.add('description')
  if (core.externalSites) availability.surfaces.add('externalSites')
  if (core.externalIds) availability.surfaces.add('externalIds')
  if (core.tags) availability.surfaces.add('tags')
  if (photoUrls) availability.surfaces.add('photos')

  return {
    incoming: {
      core,
      relationFacts: {},
      mediaCandidates: photoUrls ? { photoUrls } : {}
    },
    availability
  }
}
