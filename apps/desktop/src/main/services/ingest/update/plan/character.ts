import type { CharacterPlanContext, CharacterUpdatePlan } from '../types'
import { CHARACTER_LINK_TOPOLOGY, resolveLinkWrites } from '../link-topology'
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

export function buildCharacterPlan(context: CharacterPlanContext): CharacterUpdatePlan {
  const { current, incoming, relationGraph, selection, policy } = context
  const relations = resolveLinkWrites({
    topology: CHARACTER_LINK_TOPOLOGY,
    selectedSurfaces: selection.relationSurfaces,
    availability: incoming.availability,
    mode: policy.collectionUpdate
  })
  const plan: CharacterUpdatePlan = {
    patch: {},
    links: relations.links,
    degradedLinks: relations.degraded
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

      case 'aliases': {
        const next = mergeAliases(
          current.character.aliases,
          incoming.incoming.core.aliases ?? [],
          policy.collectionUpdate
        )
        if (!next) break
        if (areAliasesEqual(current.character.aliases, next)) break
        plan.patch.aliases = next
        break
      }

      case 'externalSites': {
        const next = mergeExternalSites(
          current.character.externalSites ?? [],
          incoming.incoming.core.externalSites ?? [],
          policy.collectionUpdate
        )
        if (!next) break
        if (areExternalSitesEqual(current.character.externalSites ?? [], next)) break
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
