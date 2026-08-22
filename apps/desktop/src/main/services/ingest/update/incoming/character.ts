import { normalizeExternalIds } from '@shared/identity'
import type { CoreCharacterMetadata } from '@shared/metadata'
import type { ScrapedCharacterBundle, ScraperLookup } from '@shared/scraper'
import type { CharacterIncomingBuildResult } from '../types'
import { buildCompleteCharacterLinks } from '../link-topology'
import {
  normalizeAliases,
  normalizeOptionalString,
  normalizeExternalSites,
  normalizeTags,
  normalizeUrlCandidates
} from '../shared/normalization'

function buildCharacterCore(
  bundle: ScrapedCharacterBundle | null,
  lookup: ScraperLookup
): Partial<CoreCharacterMetadata> {
  const core: Partial<CoreCharacterMetadata> = {}
  const bundleCore = bundle?.core

  const name = normalizeOptionalString(bundleCore?.name)
  if (name) core.name = name

  const originalName = normalizeOptionalString(bundleCore?.originalName)
  if (originalName) core.originalName = originalName

  const aliases = normalizeAliases(bundleCore?.aliases)
  if (aliases) core.aliases = aliases

  if (bundleCore?.birthDate) core.birthDate = bundleCore.birthDate
  if (bundleCore?.gender) core.gender = bundleCore.gender
  if (typeof bundleCore?.age === 'number') core.age = bundleCore.age
  if (bundleCore?.bloodType) core.bloodType = bundleCore.bloodType
  if (typeof bundleCore?.height === 'number') core.height = bundleCore.height
  if (typeof bundleCore?.weight === 'number') core.weight = bundleCore.weight
  if (typeof bundleCore?.bust === 'number') core.bust = bundleCore.bust
  if (typeof bundleCore?.waist === 'number') core.waist = bundleCore.waist
  if (typeof bundleCore?.hips === 'number') core.hips = bundleCore.hips
  if (bundleCore?.cup) core.cup = bundleCore.cup

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

export function buildCharacterIncoming(
  bundle: ScrapedCharacterBundle | null,
  lookup: ScraperLookup
): CharacterIncomingBuildResult {
  const core = buildCharacterCore(bundle, lookup)
  const photoUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.photoUrls)
  const relationFacts = bundle?.relationFacts ?? {}

  // A surface is available when the scraper spoke about it at all; an empty
  // collection is an authoritative "none", not a missing answer. Deleting rows
  // needs more, so completeness is resolved from the link topology.
  const availability: CharacterIncomingBuildResult['availability'] = {
    surfaces: new Set(),
    completeLinks: buildCompleteCharacterLinks(relationFacts)
  }

  if (core.name) availability.surfaces.add('name')
  if (core.originalName) availability.surfaces.add('originalName')
  if (core.aliases) availability.surfaces.add('aliases')
  if (core.birthDate) availability.surfaces.add('birthDate')
  if (core.gender) availability.surfaces.add('gender')
  if (typeof core.age === 'number') availability.surfaces.add('age')
  if (core.bloodType) availability.surfaces.add('bloodType')
  if (typeof core.height === 'number') availability.surfaces.add('height')
  if (typeof core.weight === 'number') availability.surfaces.add('weight')
  if (typeof core.bust === 'number') availability.surfaces.add('bust')
  if (typeof core.waist === 'number') availability.surfaces.add('waist')
  if (typeof core.hips === 'number') availability.surfaces.add('hips')
  if (core.cup) availability.surfaces.add('cup')
  if (core.description) availability.surfaces.add('description')
  if (core.externalSites) availability.surfaces.add('externalSites')
  if (core.externalIds) availability.surfaces.add('externalIds')
  if (core.tags) availability.surfaces.add('tags')
  if (relationFacts.characterPerson) availability.surfaces.add('person')
  if (photoUrls) availability.surfaces.add('photos')

  return {
    incoming: {
      core,
      relationFacts,
      mediaCandidates: photoUrls ? { photoUrls } : {}
    },
    availability
  }
}
