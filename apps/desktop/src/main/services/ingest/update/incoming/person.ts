import { normalizeExternalIds } from '@shared/identity'
import type { CorePersonMetadata } from '@shared/metadata'
import type { IngestUpdateLookup } from '@shared/ingest/update'
import type { ScrapedPersonBundle } from '@shared/scraper'
import type { PersonIncomingBuildResult } from '../types'
import {
  normalizeOptionalString,
  normalizeRelatedSites,
  normalizeTags,
  normalizeUrlCandidates
} from '../shared/normalization'

function buildPersonCore(
  bundle: ScrapedPersonBundle | null,
  lookup: IngestUpdateLookup
): Partial<CorePersonMetadata> {
  const core: Partial<CorePersonMetadata> = {}
  const bundleCore = bundle?.core

  const name = normalizeOptionalString(bundleCore?.name)
  if (name) core.name = name

  const originalName = normalizeOptionalString(bundleCore?.originalName)
  if (originalName) core.originalName = originalName

  if (bundleCore?.birthDate) core.birthDate = bundleCore.birthDate
  if (bundleCore?.deathDate) core.deathDate = bundleCore.deathDate
  if (bundleCore?.gender) core.gender = bundleCore.gender

  const description = normalizeOptionalString(bundleCore?.description)
  if (description) core.description = description

  const relatedSites = normalizeRelatedSites(bundleCore?.relatedSites)
  if (relatedSites) core.relatedSites = relatedSites

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
  lookup: IngestUpdateLookup
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
  if (core.birthDate) availability.surfaces.add('birthDate')
  if (core.deathDate) availability.surfaces.add('deathDate')
  if (core.gender) availability.surfaces.add('gender')
  if (core.description) availability.surfaces.add('description')
  if (core.relatedSites) availability.surfaces.add('relatedSites')
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
