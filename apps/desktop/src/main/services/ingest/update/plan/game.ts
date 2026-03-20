import type { GamePlanContext, GameUpdatePlan } from '../types'
import {
  areExternalIdsEqual,
  areRelatedSitesEqual,
  areScalarValuesEqual,
  areTagsEqual,
  mergeExternalIds,
  mergeRelatedSites,
  mergeTags,
  pickFirstUrl,
  shouldApplyMediaUpdate,
  shouldApplyScalarUpdate
} from '../utils'

export function buildGamePlan(context: GamePlanContext): GameUpdatePlan {
  const { current, incoming, relationGraph, selection, policy } = context
  const plan: GameUpdatePlan = {
    patch: {},
    collectionMode: policy.collectionUpdate,
    selectedRelationSurfaces: [...selection.relationSurfaces]
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

      case 'relatedSites': {
        const next = mergeRelatedSites(
          current.game.relatedSites ?? [],
          incoming.incoming.core.relatedSites ?? [],
          policy.collectionUpdate
        )
        if (!next) break
        if (areRelatedSitesEqual(current.game.relatedSites ?? [], next)) break
        plan.patch.relatedSites = next
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

  if (
    selection.relationSurfaces.some((surface) => incoming.availability.surfaces.has(surface)) &&
    relationGraph
  ) {
    plan.relationGraph = relationGraph
  }

  return plan
}
