import { normalizeExternalIds } from '@shared/identity'
import type { CoreGameMetadata } from '@shared/metadata'
import type { IngestUpdateLookup } from '@shared/ingest/update'
import type { ScrapedGameBundle } from '@shared/scraper'
import type { GameIncomingBuildResult } from '../types'
import {
  normalizeOptionalString,
  normalizeRelatedSites,
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

  const relatedSites = normalizeRelatedSites(bundleCore?.relatedSites)
  if (relatedSites) core.relatedSites = relatedSites

  const externalIds = normalizeExternalIds([
    ...(bundle?.identity.externalIds ?? []),
    ...(lookup.knownIds ?? [])
  ])
  if (externalIds.length > 0) core.externalIds = externalIds

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
  const hasDirectGamePerson = (relationFacts.gamePerson?.length ?? 0) > 0
  const hasNestedCharacterPersonFromGameCharacter = (relationFacts.gameCharacter ?? []).some(
    (fact) => (fact.persons?.length ?? 0) > 0
  )
  const hasDirectCharacterPerson = (relationFacts.characterPerson?.length ?? 0) > 0
  const hasCharacterPerson = hasNestedCharacterPersonFromGameCharacter || hasDirectCharacterPerson
  const hasGamePerson = hasDirectGamePerson || hasCharacterPerson

  const availability: GameIncomingBuildResult['availability'] = {
    surfaces: new Set()
  }

  if (core.name) availability.surfaces.add('name')
  if (core.originalName) availability.surfaces.add('originalName')
  if (core.releaseDate) availability.surfaces.add('releaseDate')
  if (core.description) availability.surfaces.add('description')
  if (core.relatedSites?.length) availability.surfaces.add('relatedSites')
  if (core.externalIds?.length) availability.surfaces.add('externalIds')
  if (core.tags?.length) availability.surfaces.add('tags')
  if (hasGamePerson) availability.surfaces.add('person')
  if ((relationFacts.gameCompany?.length ?? 0) > 0) availability.surfaces.add('company')
  if ((relationFacts.gameCharacter?.length ?? 0) > 0) availability.surfaces.add('character')
  if (coverUrls?.[0]) availability.surfaces.add('covers')
  if (backdropUrls?.[0]) availability.surfaces.add('backdrops')
  if (logoUrls?.[0]) availability.surfaces.add('logos')
  if (iconUrls?.[0]) availability.surfaces.add('icons')

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
