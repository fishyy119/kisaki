import { normalizeExternalIds } from '@shared/identity'
import type { CoreMovieMetadata } from '@shared/metadata'
import type { ScrapedMovieBundle, ScraperLookup } from '@shared/scraper'
import type { MovieIncomingBuildResult } from '../types'
import { buildCompleteMovieLinks } from '../link-topology'
import {
  normalizeOptionalString,
  normalizeExternalSites,
  normalizeTags,
  normalizeUrlCandidates
} from '../shared/normalization'

function buildMovieCore(
  bundle: ScrapedMovieBundle | null,
  lookup: ScraperLookup
): Partial<CoreMovieMetadata> {
  const core: Partial<CoreMovieMetadata> = {}
  const bundleCore = bundle?.core

  const name = normalizeOptionalString(bundleCore?.name)
  if (name) core.name = name

  const originalName = normalizeOptionalString(bundleCore?.originalName)
  if (originalName) core.originalName = originalName

  if (bundleCore?.releaseDate) core.releaseDate = bundleCore.releaseDate

  const description = normalizeOptionalString(bundleCore?.description)
  if (description) core.description = description

  if (bundleCore?.format) core.format = bundleCore.format

  if (typeof bundleCore?.runtimeMs === 'number' && Number.isFinite(bundleCore.runtimeMs)) {
    core.runtimeMs = bundleCore.runtimeMs
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

export function buildMovieIncoming(
  bundle: ScrapedMovieBundle | null,
  lookup: ScraperLookup
): MovieIncomingBuildResult {
  const core = buildMovieCore(bundle, lookup)
  const relationFacts = bundle?.relationFacts ?? {}
  const coverUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.coverUrls)
  const backdropUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.backdropUrls)
  const logoUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.logoUrls)
  const characterPersonAnswered =
    relationFacts.characterPerson !== undefined ||
    (relationFacts.movieCharacter ?? []).some((fact) => fact.persons !== undefined)

  // A surface is available when the scraper spoke about it at all; an empty
  // collection is an authoritative "none", not a missing answer. Deleting rows
  // needs more, so completeness is resolved from the link topology.
  const availability: MovieIncomingBuildResult['availability'] = {
    surfaces: new Set(),
    completeLinks: buildCompleteMovieLinks(relationFacts)
  }

  if (core.name) availability.surfaces.add('name')
  if (core.originalName) availability.surfaces.add('originalName')
  if (core.releaseDate) availability.surfaces.add('releaseDate')
  if (core.description) availability.surfaces.add('description')
  if (core.format) availability.surfaces.add('format')
  if (core.runtimeMs !== undefined) availability.surfaces.add('runtimeMs')
  if (core.externalSites) availability.surfaces.add('externalSites')
  if (core.externalIds) availability.surfaces.add('externalIds')
  if (core.tags) availability.surfaces.add('tags')
  if (relationFacts.moviePerson !== undefined || characterPersonAnswered) {
    availability.surfaces.add('person')
  }
  if (relationFacts.movieCompany !== undefined) availability.surfaces.add('company')
  if (relationFacts.movieCharacter !== undefined) availability.surfaces.add('character')
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
    availability
  }
}
