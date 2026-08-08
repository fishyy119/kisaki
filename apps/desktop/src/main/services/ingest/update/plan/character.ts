import type { CharacterPlanContext, CharacterUpdatePlan } from '../types'
import { CHARACTER_RELATION_LINKS, resolveRelationLinks } from '../relation-links'
import {
  areExternalIdsEqual,
  areRelatedSitesEqual,
  areScalarValuesEqual,
  areTagsEqual,
  mergeExternalIds,
  mergeRelatedSites,
  mergeTags
} from '../shared/merge'
import { pickFirstUrl } from '../shared/normalization'
import { shouldApplyMediaUpdate, shouldApplyScalarUpdate } from '../shared/policy'

export function buildCharacterPlan(context: CharacterPlanContext): CharacterUpdatePlan {
  const { current, incoming, relationGraph, selection, policy } = context
  const relations = resolveRelationLinks({
    links: CHARACTER_RELATION_LINKS,
    selectedSurfaces: selection.relationSurfaces,
    availability: incoming.availability,
    mode: policy.collectionUpdate
  })
  const plan: CharacterUpdatePlan = {
    patch: {},
    relationLinks: relations.links,
    degradedRelationLinks: relations.degraded
  }

  for (const surface of selection.coreSurfaces) {
    if (!incoming.availability.surfaces.has(surface)) continue

    switch (surface) {
      case 'name':
      case 'originalName':
      case 'birthDate':
      case 'gender':
      case 'age':
      case 'bloodType':
      case 'height':
      case 'weight':
      case 'bust':
      case 'waist':
      case 'hips':
      case 'cup':
      case 'description': {
        const incomingValue = incoming.incoming.core[surface]
        const currentValue = current.character[surface]

        if (!shouldApplyScalarUpdate(currentValue, incomingValue, policy.singularUpdate)) break
        if (areScalarValuesEqual(currentValue, incomingValue)) break
        ;(plan.patch as Record<string, unknown>)[surface] = incomingValue
        break
      }

      case 'relatedSites': {
        const next = mergeRelatedSites(
          current.character.relatedSites ?? [],
          incoming.incoming.core.relatedSites ?? [],
          policy.collectionUpdate
        )
        if (!next) break
        if (areRelatedSitesEqual(current.character.relatedSites ?? [], next)) break
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

  if (selection.mediaSurfaces.includes('photos') && incoming.availability.surfaces.has('photos')) {
    const photoUrl = pickFirstUrl(incoming.incoming.mediaCandidates.photoUrls)
    if (shouldApplyMediaUpdate(current.character.photoFile, photoUrl, policy.singularUpdate)) {
      plan.photoUrl = photoUrl
    }
  }

  if (Object.keys(relations.links).length > 0 && relationGraph) {
    plan.relationGraph = relationGraph
  }

  return plan
}
