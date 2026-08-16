import { normalizeExternalIds } from '@shared/identity'
import type { CoreTvMetadata } from '@shared/metadata'
import type { ScrapedTvBundle, ScraperLookup } from '@shared/scraper'
import { normalizeTvEpisodes, normalizeTvSeasons } from '../../graph'
import type { TvIncomingBuildResult } from '../types'
import { buildCompleteTvLinks } from '../link-topology'
import {
  normalizeOptionalString,
  normalizeExternalSites,
  normalizeTags,
  normalizeUrlCandidates
} from '../shared/normalization'

function buildTvCore(
  bundle: ScrapedTvBundle | null,
  lookup: ScraperLookup
): Partial<CoreTvMetadata> {
  const core: Partial<CoreTvMetadata> = {}
  const bundleCore = bundle?.core

  const name = normalizeOptionalString(bundleCore?.name)
  if (name) core.name = name

  const originalName = normalizeOptionalString(bundleCore?.originalName)
  if (originalName) core.originalName = originalName

  if (bundleCore?.releaseDate) core.releaseDate = bundleCore.releaseDate

  if (bundleCore?.endDate) core.endDate = bundleCore.endDate

  const description = normalizeOptionalString(bundleCore?.description)
  if (description) core.description = description

  if (bundleCore?.format) core.format = bundleCore.format

  if (typeof bundleCore?.totalSeasons === 'number' && Number.isFinite(bundleCore.totalSeasons)) {
    core.totalSeasons = bundleCore.totalSeasons
  }

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

export function buildTvIncoming(
  bundle: ScrapedTvBundle | null,
  lookup: ScraperLookup
): TvIncomingBuildResult {
  const core = buildTvCore(bundle, lookup)
  const seasons = normalizeTvSeasons(bundle?.seasons)
  const episodes = normalizeTvEpisodes(bundle?.episodes)
  const relationFacts = bundle?.relationFacts ?? {}
  const coverUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.coverUrls)
  const backdropUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.backdropUrls)
  const logoUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.logoUrls)
  const characterPersonAnswered =
    relationFacts.characterPerson !== undefined ||
    (relationFacts.tvCharacter ?? []).some((fact) => fact.persons !== undefined)

  // A surface is available when the scraper spoke about it at all; an empty
  // collection is an authoritative "none", not a missing answer. Deleting rows
  // needs more, so completeness is resolved from the link topology.
  const availability: TvIncomingBuildResult['availability'] = {
    surfaces: new Set(),
    completeLinks: buildCompleteTvLinks(relationFacts)
  }

  if (core.name) availability.surfaces.add('name')
  if (core.originalName) availability.surfaces.add('originalName')
  if (core.releaseDate) availability.surfaces.add('releaseDate')
  if (core.endDate) availability.surfaces.add('endDate')
  if (core.description) availability.surfaces.add('description')
  if (core.format) availability.surfaces.add('format')
  if (core.totalSeasons !== undefined) availability.surfaces.add('totalSeasons')
  if (core.totalEpisodes !== undefined) availability.surfaces.add('totalEpisodes')
  if (core.externalSites) availability.surfaces.add('externalSites')
  if (core.externalIds) availability.surfaces.add('externalIds')
  if (core.tags) availability.surfaces.add('tags')
  // An empty list is an authoritative "none", so presence is what counts.
  if (seasons !== undefined) availability.surfaces.add('seasons')
  if (episodes !== undefined) availability.surfaces.add('episodes')
  if (relationFacts.tvPerson !== undefined || characterPersonAnswered) {
    availability.surfaces.add('person')
  }
  if (relationFacts.tvCompany !== undefined) availability.surfaces.add('company')
  if (relationFacts.tvCharacter !== undefined) availability.surfaces.add('character')
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
    ...(seasons !== undefined ? { seasons } : {}),
    ...(episodes !== undefined ? { episodes } : {}),
    availability
  }
}
