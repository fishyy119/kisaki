import type { NovelPlanContext, NovelUpdatePlan } from './types'
import { NOVEL_LINK_TOPOLOGY, resolveLinkWrites } from '../link-topology'
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
import { pickFirstUrl } from '../../normalization'
import { shouldApplyMediaUpdate, shouldApplyScalarUpdate } from '../shared/policy'

export function buildNovelPlan(context: NovelPlanContext): NovelUpdatePlan {
  const { current, incoming, relationGraph, selection, policy } = context
  const relations = resolveLinkWrites({
    topology: NOVEL_LINK_TOPOLOGY,
    selectedSurfaces: selection.relationSurfaces,
    availability: incoming.availability,
    mode: policy.collectionUpdate
  })
  const plan: NovelUpdatePlan = {
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
      case 'description':
      case 'format':
      case 'totalVolumes': {
        const incomingValue = incoming.incoming.core[surface]
        const currentValue = current.novel[surface]

        if (!shouldApplyScalarUpdate(currentValue, incomingValue, policy.singularUpdate)) break
        if (areScalarValuesEqual(currentValue, incomingValue)) break
        ;(plan.patch as Record<string, unknown>)[surface] = incomingValue
        break
      }

      case 'aliases': {
        const next = mergeAliases(
          current.novel.aliases,
          incoming.incoming.core.aliases ?? [],
          policy.collectionUpdate
        )
        if (!next) break
        if (areAliasesEqual(current.novel.aliases, next)) break
        plan.patch.aliases = next
        break
      }

      case 'externalSites': {
        const next = mergeExternalSites(
          current.novel.externalSites ?? [],
          incoming.incoming.core.externalSites ?? [],
          policy.collectionUpdate
        )
        if (!next) break
        if (areExternalSitesEqual(current.novel.externalSites ?? [], next)) break
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

      case 'volumes': {
        // The apply step reconciles against stored rows inside the write
        // transaction, so the plan only carries the authoritative list and the
        // mode that decides whether unmatched stored rows may be deleted.
        plan.volumes = {
          items: incoming.volumes ?? [],
          mode: policy.collectionUpdate
        }
        break
      }
    }
  }

  if (selection.mediaSurfaces.includes('covers') && incoming.availability.surfaces.has('covers')) {
    const coverUrl = pickFirstUrl(incoming.incoming.mediaCandidates.coverUrls)
    if (shouldApplyMediaUpdate(current.novel.coverFile, coverUrl, policy.singularUpdate)) {
      plan.coverUrl = coverUrl
    }
  }

  if (
    selection.mediaSurfaces.includes('backdrops') &&
    incoming.availability.surfaces.has('backdrops')
  ) {
    const backdropUrl = pickFirstUrl(incoming.incoming.mediaCandidates.backdropUrls)
    if (shouldApplyMediaUpdate(current.novel.backdropFile, backdropUrl, policy.singularUpdate)) {
      plan.backdropUrl = backdropUrl
    }
  }

  if (selection.mediaSurfaces.includes('logos') && incoming.availability.surfaces.has('logos')) {
    const logoUrl = pickFirstUrl(incoming.incoming.mediaCandidates.logoUrls)
    if (shouldApplyMediaUpdate(current.novel.logoFile, logoUrl, policy.singularUpdate)) {
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
