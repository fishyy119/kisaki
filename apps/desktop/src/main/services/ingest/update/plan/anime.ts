import type { AnimePlanContext, AnimeUpdatePlan } from '../types'
import { ANIME_RELATION_LINKS, resolveRelationLinks } from '../relation-links'
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

export function buildAnimePlan(context: AnimePlanContext): AnimeUpdatePlan {
  const { current, incoming, relationGraph, selection, policy } = context
  const relations = resolveRelationLinks({
    links: ANIME_RELATION_LINKS,
    selectedSurfaces: selection.relationSurfaces,
    availability: incoming.availability,
    mode: policy.collectionUpdate
  })
  const plan: AnimeUpdatePlan = {
    patch: {},
    relationLinks: relations.links,
    degradedRelationLinks: relations.degraded
  }

  for (const surface of selection.coreSurfaces) {
    if (!incoming.availability.surfaces.has(surface)) continue

    switch (surface) {
      case 'name':
      case 'originalName':
      case 'releaseDate':
      case 'description':
      case 'format':
      case 'totalEpisodes': {
        const incomingValue = incoming.incoming.core[surface]
        const currentValue = current.anime[surface]

        if (!shouldApplyScalarUpdate(currentValue, incomingValue, policy.singularUpdate)) break
        if (areScalarValuesEqual(currentValue, incomingValue)) break
        ;(plan.patch as Record<string, unknown>)[surface] = incomingValue
        break
      }

      case 'relatedSites': {
        const next = mergeRelatedSites(
          current.anime.relatedSites ?? [],
          incoming.incoming.core.relatedSites ?? [],
          policy.collectionUpdate
        )
        if (!next) break
        if (areRelatedSitesEqual(current.anime.relatedSites ?? [], next)) break
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

      case 'episodes': {
        // The apply step reconciles against stored rows inside the write
        // transaction, so the plan only carries the authoritative list and the
        // mode that decides whether unmatched stored rows may be deleted.
        plan.episodes = {
          items: incoming.episodes ?? [],
          mode: policy.collectionUpdate
        }
        break
      }
    }
  }

  if (selection.mediaSurfaces.includes('covers') && incoming.availability.surfaces.has('covers')) {
    const coverUrl = pickFirstUrl(incoming.incoming.mediaCandidates.coverUrls)
    if (shouldApplyMediaUpdate(current.anime.coverFile, coverUrl, policy.singularUpdate)) {
      plan.coverUrl = coverUrl
    }
  }

  if (
    selection.mediaSurfaces.includes('backdrops') &&
    incoming.availability.surfaces.has('backdrops')
  ) {
    const backdropUrl = pickFirstUrl(incoming.incoming.mediaCandidates.backdropUrls)
    if (shouldApplyMediaUpdate(current.anime.backdropFile, backdropUrl, policy.singularUpdate)) {
      plan.backdropUrl = backdropUrl
    }
  }

  if (selection.mediaSurfaces.includes('logos') && incoming.availability.surfaces.has('logos')) {
    const logoUrl = pickFirstUrl(incoming.incoming.mediaCandidates.logoUrls)
    if (shouldApplyMediaUpdate(current.anime.logoFile, logoUrl, policy.singularUpdate)) {
      plan.logoUrl = logoUrl
    }
  }

  if (Object.keys(relations.links).length > 0 && relationGraph) {
    plan.relationGraph = relationGraph
  }

  return plan
}
