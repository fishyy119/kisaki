import type { GamePlanContext, GameUpdatePlan } from '../types'
import { GAME_LINK_TOPOLOGY, resolveLinkWrites } from '../link-topology'
import {
  areAliasesEqual,
  areExternalIdsEqual,
  areExternalSitesEqual,
  areScalarValuesEqual,
  areTagsEqual,
  mergeAliases,
  mergeExternalIds,
  mergeExternalSites,
  mergeTags
} from '../shared/merge'
import { pickFirstUrl } from '../shared/normalization'
import { shouldApplyMediaUpdate, shouldApplyScalarUpdate } from '../shared/policy'

export function buildGamePlan(context: GamePlanContext): GameUpdatePlan {
  const { current, incoming, relationGraph, selection, policy } = context
  const relations = resolveLinkWrites({
    topology: GAME_LINK_TOPOLOGY,
    selectedSurfaces: selection.relationSurfaces,
    availability: incoming.availability,
    mode: policy.collectionUpdate
  })
  const plan: GameUpdatePlan = {
    patch: {},
    links: relations.links,
    degradedLinks: relations.degraded
  }

  for (const surface of selection.coreSurfaces) {
    if (!incoming.availability.surfaces.has(surface)) continue

    switch (surface) {
      case 'name':
      case 'originalName':
      case 'releaseDate':
      case 'description': {
        const incomingValue = incoming.incoming.core[surface]
        const currentValue = current.game[surface]

        if (!shouldApplyScalarUpdate(currentValue, incomingValue, policy.singularUpdate)) break
        if (areScalarValuesEqual(currentValue, incomingValue)) break
        ;(plan.patch as Record<string, unknown>)[surface] = incomingValue
        break
      }

      case 'aliases': {
        const next = mergeAliases(
          current.game.aliases,
          incoming.incoming.core.aliases ?? [],
          policy.collectionUpdate
        )
        if (!next) break
        if (areAliasesEqual(current.game.aliases, next)) break
        plan.patch.aliases = next
        break
      }

      case 'externalSites': {
        const next = mergeExternalSites(
          current.game.externalSites ?? [],
          incoming.incoming.core.externalSites ?? [],
          policy.collectionUpdate
        )
        if (!next) break
        if (areExternalSitesEqual(current.game.externalSites ?? [], next)) break
        plan.patch.externalSites = next
        break
      }

      case 'externalIds': {
        const next = mergeExternalIds(
          current.externalIds,
          incoming.incoming.core.externalIds ?? [],
          policy.collectionUpdate
        )
        if (!next) break
        if (areExternalIdsEqual(current.externalIds, next)) break
        plan.externalIds = next
        break
      }

      case 'tags': {
        const next = mergeTags(
          current.tags,
          incoming.incoming.core.tags ?? [],
          policy.collectionUpdate
        )
        if (!next) break
        if (areTagsEqual(current.tags, next)) break
        plan.tags = next
        break
      }
    }
  }

  if (selection.mediaSurfaces.includes('covers') && incoming.availability.surfaces.has('covers')) {
    const coverUrl = pickFirstUrl(incoming.incoming.mediaCandidates.coverUrls)
    if (shouldApplyMediaUpdate(current.game.coverFile, coverUrl, policy.singularUpdate)) {
      plan.coverUrl = coverUrl
    }
  }

  if (
    selection.mediaSurfaces.includes('backdrops') &&
    incoming.availability.surfaces.has('backdrops')
  ) {
    const backdropUrl = pickFirstUrl(incoming.incoming.mediaCandidates.backdropUrls)
    if (shouldApplyMediaUpdate(current.game.backdropFile, backdropUrl, policy.singularUpdate)) {
      plan.backdropUrl = backdropUrl
    }
  }

  if (selection.mediaSurfaces.includes('logos') && incoming.availability.surfaces.has('logos')) {
    const logoUrl = pickFirstUrl(incoming.incoming.mediaCandidates.logoUrls)
    if (shouldApplyMediaUpdate(current.game.logoFile, logoUrl, policy.singularUpdate)) {
      plan.logoUrl = logoUrl
    }
  }

  if (selection.mediaSurfaces.includes('icons') && incoming.availability.surfaces.has('icons')) {
    const iconUrl = pickFirstUrl(incoming.incoming.mediaCandidates.iconUrls)
    if (shouldApplyMediaUpdate(current.game.iconFile, iconUrl, policy.singularUpdate)) {
      plan.iconUrl = iconUrl
    }
  }

  if (Object.keys(relations.links).length > 0 && relationGraph) {
    plan.relationGraph = relationGraph
  }

  if (
    selection.relationSurfaces.includes('relatedEntries') &&
    incoming.availability.surfaces.has('relatedEntries')
  ) {
    plan.relatedEntries = {
      facts: incoming.incoming.relationFacts.relatedEntries ?? [],
      mode: policy.collectionUpdate
    }
  }

  return plan
}
