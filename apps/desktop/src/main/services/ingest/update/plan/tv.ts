import type { TvPlanContext, TvUpdatePlan } from '../types'
import { TV_LINK_TOPOLOGY, resolveLinkWrites } from '../link-topology'
import {
  areExternalIdsEqual,
  areExternalSitesEqual,
  areScalarValuesEqual,
  areTagsEqual,
  mergeExternalIds,
  mergeExternalSites,
  mergeTags
} from '../shared/merge'
import { pickFirstUrl } from '../shared/normalization'
import { shouldApplyMediaUpdate, shouldApplyScalarUpdate } from '../shared/policy'

export function buildTvPlan(context: TvPlanContext): TvUpdatePlan {
  const { current, incoming, relationGraph, selection, policy } = context
  const relations = resolveLinkWrites({
    topology: TV_LINK_TOPOLOGY,
    selectedSurfaces: selection.relationSurfaces,
    availability: incoming.availability,
    mode: policy.collectionUpdate
  })
  const plan: TvUpdatePlan = {
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
      case 'endDate':
      case 'description':
      case 'format':
      case 'totalSeasons':
      case 'totalEpisodes': {
        const incomingValue = incoming.incoming.core[surface]
        const currentValue = current.tv[surface]

        if (!shouldApplyScalarUpdate(currentValue, incomingValue, policy.singularUpdate)) break
        if (areScalarValuesEqual(currentValue, incomingValue)) break
        ;(plan.patch as Record<string, unknown>)[surface] = incomingValue
        break
      }

      case 'externalSites': {
        const next = mergeExternalSites(
          current.tv.externalSites ?? [],
          incoming.incoming.core.externalSites ?? [],
          policy.collectionUpdate
        )
        if (!next) break
        if (areExternalSitesEqual(current.tv.externalSites ?? [], next)) break
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

      case 'seasons': {
        // The apply step reconciles against stored rows inside the write
        // transaction, so the plan only carries the authoritative list and the
        // mode that decides whether unmatched stored rows may be deleted.
        plan.seasons = {
          items: incoming.seasons ?? [],
          mode: policy.collectionUpdate
        }
        break
      }

      case 'episodes': {
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
    if (shouldApplyMediaUpdate(current.tv.coverFile, coverUrl, policy.singularUpdate)) {
      plan.coverUrl = coverUrl
    }
  }

  if (
    selection.mediaSurfaces.includes('backdrops') &&
    incoming.availability.surfaces.has('backdrops')
  ) {
    const backdropUrl = pickFirstUrl(incoming.incoming.mediaCandidates.backdropUrls)
    if (shouldApplyMediaUpdate(current.tv.backdropFile, backdropUrl, policy.singularUpdate)) {
      plan.backdropUrl = backdropUrl
    }
  }

  if (selection.mediaSurfaces.includes('logos') && incoming.availability.surfaces.has('logos')) {
    const logoUrl = pickFirstUrl(incoming.incoming.mediaCandidates.logoUrls)
    if (shouldApplyMediaUpdate(current.tv.logoFile, logoUrl, policy.singularUpdate)) {
      plan.logoUrl = logoUrl
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
