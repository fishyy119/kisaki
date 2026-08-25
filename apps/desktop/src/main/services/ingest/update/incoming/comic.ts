import { normalizeExternalIds } from '@shared/identity'
import type { CoreComicMetadata } from '@shared/metadata'
import type { ScrapedComicBundle, ScraperLookup } from '@shared/scraper'
import { normalizeComicChapters } from '../../graph'
import type { ComicIncomingBuildResult } from '../types'
import { buildCompleteComicLinks } from '../link-topology'
import {
  normalizeAliases,
  normalizeOptionalString,
  normalizeExternalSites,
  normalizeTags,
  normalizeUrlCandidates
} from '../shared/normalization'

function buildComicCore(
  bundle: ScrapedComicBundle | null,
  lookup: ScraperLookup
): Partial<CoreComicMetadata> {
  const core: Partial<CoreComicMetadata> = {}
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

  if (typeof bundleCore?.totalChapters === 'number' && Number.isFinite(bundleCore.totalChapters)) {
    core.totalChapters = bundleCore.totalChapters
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

export function buildComicIncoming(
  bundle: ScrapedComicBundle | null,
  lookup: ScraperLookup
): ComicIncomingBuildResult {
  const core = buildComicCore(bundle, lookup)
  const chapters = normalizeComicChapters(bundle?.chapters)
  const relationFacts = bundle?.relationFacts ?? {}
  const coverUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.coverUrls)
  const backdropUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.backdropUrls)
  const logoUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.logoUrls)
  const characterPersonAnswered =
    relationFacts.characterPerson !== undefined ||
    (relationFacts.comicCharacter ?? []).some((fact) => fact.persons !== undefined)

  // A surface is available when the scraper spoke about it at all; an empty
  // collection is an authoritative "none", not a missing answer. Deleting rows
  // needs more, so completeness is resolved from the link topology.
  const availability: ComicIncomingBuildResult['availability'] = {
    surfaces: new Set(),
    completeLinks: buildCompleteComicLinks(relationFacts)
  }

  if (core.name) availability.surfaces.add('name')
  if (core.originalName) availability.surfaces.add('originalName')
  if (core.aliases) availability.surfaces.add('aliases')
  if (core.releaseDate) availability.surfaces.add('releaseDate')
  if (core.description) availability.surfaces.add('description')
  if (core.format) availability.surfaces.add('format')
  if (core.totalVolumes !== undefined) availability.surfaces.add('totalVolumes')
  if (core.totalChapters !== undefined) availability.surfaces.add('totalChapters')
  if (core.externalSites) availability.surfaces.add('externalSites')
  if (core.externalIds) availability.surfaces.add('externalIds')
  if (core.tags) availability.surfaces.add('tags')
  // An empty unit list is an authoritative "none", so presence is what counts.
  if (chapters !== undefined) availability.surfaces.add('chapters')
  if (relationFacts.comicPerson !== undefined || characterPersonAnswered) {
    availability.surfaces.add('person')
  }
  if (relationFacts.comicCompany !== undefined) availability.surfaces.add('company')
  if (relationFacts.comicCharacter !== undefined) availability.surfaces.add('character')
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
    ...(chapters !== undefined ? { chapters } : {}),
    availability
  }
}
