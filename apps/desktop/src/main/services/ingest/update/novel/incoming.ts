import { normalizeExternalIds } from '@shared/identity'
import type { CoreNovelMetadata } from '@shared/metadata'
import type { ScrapedNovelBundle, ScraperLookup } from '@shared/scraper'
import { normalizeNovelVolumes } from '../../graph'
import type { NovelIncomingBuildResult } from './types'
import { buildCompleteNovelLinks } from '../link-topology'
import {
  normalizeAliases,
  normalizeOptionalString,
  normalizeExternalSites,
  normalizeTags,
  normalizeUrlCandidates
} from '../../normalization'

function buildNovelCore(
  bundle: ScrapedNovelBundle | null,
  lookup: ScraperLookup
): Partial<CoreNovelMetadata> {
  const core: Partial<CoreNovelMetadata> = {}
  const bundleCore = bundle?.core

  const name = normalizeOptionalString(bundleCore?.name)
  if (name) core.name = name

  const originalName = normalizeOptionalString(bundleCore?.originalName)
  if (originalName) core.originalName = originalName

  const aliases = normalizeAliases(bundleCore?.aliases)
  if (aliases) core.aliases = aliases

  if (bundleCore?.releaseDate) core.releaseDate = bundleCore.releaseDate

  const description = normalizeOptionalString(bundleCore?.description)
  if (description) core.description = description

  if (bundleCore?.format) core.format = bundleCore.format

  if (typeof bundleCore?.totalVolumes === 'number' && Number.isFinite(bundleCore.totalVolumes)) {
    core.totalVolumes = bundleCore.totalVolumes
  }

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

export function buildNovelIncoming(
  bundle: ScrapedNovelBundle | null,
  lookup: ScraperLookup
): NovelIncomingBuildResult {
  const core = buildNovelCore(bundle, lookup)
  const volumes = normalizeNovelVolumes(bundle?.volumes)
  const relationFacts = bundle?.relationFacts ?? {}
  const coverUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.coverUrls)
  const backdropUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.backdropUrls)
  const logoUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.logoUrls)
  const characterPersonAnswered =
    relationFacts.characterPerson !== undefined ||
    (relationFacts.novelCharacter ?? []).some((fact) => fact.persons !== undefined)

  // A surface is available when the scraper spoke about it at all; an empty
  // collection is an authoritative "none", not a missing answer. Deleting rows
  // needs more, so completeness is resolved from the link topology.
  const availability: NovelIncomingBuildResult['availability'] = {
    surfaces: new Set(),
    completeLinks: buildCompleteNovelLinks(relationFacts)
  }

  if (core.name) availability.surfaces.add('name')
  if (core.originalName) availability.surfaces.add('originalName')
  if (core.aliases) availability.surfaces.add('aliases')
  if (core.releaseDate) availability.surfaces.add('releaseDate')
  if (core.description) availability.surfaces.add('description')
  if (core.format) availability.surfaces.add('format')
  if (core.totalVolumes !== undefined) availability.surfaces.add('totalVolumes')
  if (core.externalSites) availability.surfaces.add('externalSites')
  if (core.externalIds) availability.surfaces.add('externalIds')
  if (core.tags) availability.surfaces.add('tags')
  // An empty volume list is an authoritative "none", so presence is what counts.
  if (volumes !== undefined) availability.surfaces.add('volumes')
  if (relationFacts.novelPerson !== undefined || characterPersonAnswered) {
    availability.surfaces.add('person')
  }
  if (relationFacts.novelCompany !== undefined) availability.surfaces.add('company')
  if (relationFacts.novelCharacter !== undefined) availability.surfaces.add('character')
  if (characterPersonAnswered) availability.surfaces.add('characterPerson')
  if (relationFacts.relatedEntries !== undefined) availability.surfaces.add('relatedEntries')
  if (coverUrls) availability.surfaces.add('covers')
  if (backdropUrls) availability.surfaces.add('backdrops')
  if (logoUrls) availability.surfaces.add('logos')

  return {
    incoming: {
      core,
      relationFacts,
      mediaCandidates: {
        ...(coverUrls ? { coverUrls } : {}),
        ...(backdropUrls ? { backdropUrls } : {}),
        ...(logoUrls ? { logoUrls } : {})
      }
    },
    ...(volumes !== undefined ? { volumes } : {}),
    availability
  }
}
