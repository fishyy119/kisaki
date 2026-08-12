import { normalizeExternalIds } from '@shared/identity'
import type { CoreGameMetadata } from '@shared/metadata'
import type { IngestUpdateLookup } from '@shared/ingest/update'
import type { ScrapedGameBundle } from '@shared/scraper'
import type { GameIncomingBuildResult } from '../types'
import { buildCompleteGameLinks } from '../link-topology'
import {
  normalizeOptionalString,
  normalizeExternalSites,
  normalizeTags,
  normalizeUrlCandidates
} from '../shared/normalization'

function buildGameCore(
  bundle: ScrapedGameBundle | null,
  lookup: IngestUpdateLookup
): Partial<CoreGameMetadata> {
  const core: Partial<CoreGameMetadata> = {}
  const bundleCore = bundle?.core

  const name = normalizeOptionalString(bundleCore?.name)
  if (name) core.name = name

  const originalName = normalizeOptionalString(bundleCore?.originalName)
  if (originalName) core.originalName = originalName

  if (bundleCore?.releaseDate) core.releaseDate = bundleCore.releaseDate

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

export function buildGameIncoming(
  bundle: ScrapedGameBundle | null,
  lookup: IngestUpdateLookup
): GameIncomingBuildResult {
  const core = buildGameCore(bundle, lookup)
  const relationFacts = bundle?.relationFacts ?? {}
  const coverUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.coverUrls)
  const backdropUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.backdropUrls)
  const logoUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.logoUrls)
  const iconUrls = normalizeUrlCandidates(bundle?.mediaCandidates?.iconUrls)
  const characterPersonAnswered =
    relationFacts.characterPerson !== undefined ||
    (relationFacts.gameCharacter ?? []).some((fact) => fact.persons !== undefined)

  // A surface is available when the scraper spoke about it at all; an empty
  // collection is an authoritative "none", not a missing answer. Deleting rows
  // needs more, so completeness is resolved from the link topology.
  const availability: GameIncomingBuildResult['availability'] = {
    surfaces: new Set(),
    completeLinks: buildCompleteGameLinks(relationFacts)
  }

  if (core.name) availability.surfaces.add('name')
  if (core.originalName) availability.surfaces.add('originalName')
  if (core.releaseDate) availability.surfaces.add('releaseDate')
  if (core.description) availability.surfaces.add('description')
  if (core.externalSites) availability.surfaces.add('externalSites')
  if (core.externalIds) availability.surfaces.add('externalIds')
  if (core.tags) availability.surfaces.add('tags')
  if (relationFacts.gamePerson !== undefined || characterPersonAnswered) {
    availability.surfaces.add('person')
  }
  if (relationFacts.gameCompany !== undefined) availability.surfaces.add('company')
  if (relationFacts.gameCharacter !== undefined) availability.surfaces.add('character')
  if (characterPersonAnswered) availability.surfaces.add('characterPerson')
  if (relationFacts.relatedEntries !== undefined) availability.surfaces.add('relatedEntries')
  if (coverUrls) availability.surfaces.add('covers')
  if (backdropUrls) availability.surfaces.add('backdrops')
  if (logoUrls) availability.surfaces.add('logos')
  if (iconUrls) availability.surfaces.add('icons')

  return {
    incoming: {
      core,
      relationFacts,
      mediaCandidates: {
        ...(coverUrls ? { coverUrls } : {}),
        ...(backdropUrls ? { backdropUrls } : {}),
        ...(logoUrls ? { logoUrls } : {}),
        ...(iconUrls ? { iconUrls } : {})
      }
    },
    availability
  }
}
