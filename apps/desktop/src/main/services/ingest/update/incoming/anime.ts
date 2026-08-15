import { normalizeExternalIds } from '@shared/identity'
import type { CoreAnimeMetadata } from '@shared/metadata'
import type { ScrapedAnimeBundle, ScraperLookup } from '@shared/scraper'
import { normalizeAnimeEpisodes } from '../../graph'
import type { AnimeIncomingBuildResult } from '../types'
import { buildCompleteAnimeLinks } from '../link-topology'
import {
  normalizeOptionalString,
  normalizeExternalSites,
  normalizeTags,
  normalizeUrlCandidates
} from '../shared/normalization'

function buildAnimeCore(
  bundle: ScrapedAnimeBundle | null,
  lookup: ScraperLookup
): Partial<CoreAnimeMetadata> {
  const core: Partial<CoreAnimeMetadata> = {}
  const bundleCore = bundle?.core

  const name = normalizeOptionalString(bundleCore?.name)
  if (name) core.name = name

  const originalName = normalizeOptionalString(bundleCore?.originalName)
  if (originalName) core.originalName = originalName

  if (bundleCore?.releaseDate) core.releaseDate = bundleCore.releaseDate

  const description = normalizeOptionalString(bundleCore?.description)
  if (description) core.description = description

  if (bundleCore?.format) core.format = bundleCore.format

  if (typeof bundleCore?.totalEpisodes === 'number' && Number.isFinite(bundleCore.totalEpisodes)) {
    core.totalEpisodes = bundleCore.totalEpisodes
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

export function buildAnimeIncoming(
  bundle: ScrapedAnimeBundle | null,
  lookup: ScraperLookup
): AnimeIncomingBuildResult {
  const core = buildAnimeCore(bundle, lookup)
  const episodes = normalizeAnimeEpisodes(bundle?.episodes)
  const relationFacts = bundle?.relationFacts ?? {}
  const coverUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.coverUrls)
  const backdropUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.backdropUrls)
  const logoUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.logoUrls)
  const characterPersonAnswered =
    relationFacts.characterPerson !== undefined ||
    (relationFacts.animeCharacter ?? []).some((fact) => fact.persons !== undefined)

  // A surface is available when the scraper spoke about it at all; an empty
  // collection is an authoritative "none", not a missing answer. Deleting rows
  // needs more, so completeness is resolved from the link topology.
  const availability: AnimeIncomingBuildResult['availability'] = {
    surfaces: new Set(),
    completeLinks: buildCompleteAnimeLinks(relationFacts)
  }

  if (core.name) availability.surfaces.add('name')
  if (core.originalName) availability.surfaces.add('originalName')
  if (core.releaseDate) availability.surfaces.add('releaseDate')
  if (core.description) availability.surfaces.add('description')
  if (core.format) availability.surfaces.add('format')
  if (core.totalEpisodes !== undefined) availability.surfaces.add('totalEpisodes')
  if (core.externalSites) availability.surfaces.add('externalSites')
  if (core.externalIds) availability.surfaces.add('externalIds')
  if (core.tags) availability.surfaces.add('tags')
  // An empty episode list is an authoritative "none", so presence is what counts.
  if (episodes !== undefined) availability.surfaces.add('episodes')
  // Cast facts do not feed anime person links, so unlike game they do not
  // answer the person surface.
  if (relationFacts.animePerson !== undefined) availability.surfaces.add('person')
  if (relationFacts.animeCompany !== undefined) availability.surfaces.add('company')
  if (relationFacts.animeCharacter !== undefined) availability.surfaces.add('character')
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
    ...(episodes !== undefined ? { episodes } : {}),
    availability
  }
}
