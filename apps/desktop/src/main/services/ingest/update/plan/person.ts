import type { PersonPlanContext, PersonUpdatePlan } from '../types'
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

export function buildPersonPlan(context: PersonPlanContext): PersonUpdatePlan {
  const { current, incoming, selection, policy } = context
  const plan: PersonUpdatePlan = { patch: {} }

  for (const surface of selection.coreSurfaces) {
    if (!incoming.availability.surfaces.has(surface)) continue

    switch (surface) {
      case 'name':
      case 'originalName':
      case 'birthDate':
      case 'deathDate':
      case 'gender':
      case 'description': {
        const incomingValue = incoming.incoming.core[surface]
        const currentValue = current.person[surface]

        if (!shouldApplyScalarUpdate(currentValue, incomingValue, policy.singularUpdate)) break
        if (areScalarValuesEqual(currentValue, incomingValue)) break
        ;(plan.patch as Record<string, unknown>)[surface] = incomingValue
        break
      }

      case 'aliases': {
        const next = mergeAliases(
          current.person.aliases,
          incoming.incoming.core.aliases ?? [],
          policy.collectionUpdate
        )
        if (!next) break
        if (areAliasesEqual(current.person.aliases, next)) break
        plan.patch.aliases = next
        break
      }

      case 'externalSites': {
        const next = mergeExternalSites(
          current.person.externalSites ?? [],
          incoming.incoming.core.externalSites ?? [],
          policy.collectionUpdate
        )
        if (!next) break
        if (areExternalSitesEqual(current.person.externalSites ?? [], next)) break
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
    if (shouldApplyMediaUpdate(current.person.photoFile, photoUrl, policy.singularUpdate)) {
      plan.photoUrl = photoUrl
    }
  }

  return plan
}
