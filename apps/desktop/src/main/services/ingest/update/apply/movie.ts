import { eq } from 'drizzle-orm'
import { movieExternalIdLink, requireExternalIdsAvailable, type DbContext } from '@main/services/db'
import { IngestPersistHandlers } from '../../persist'
import type { PendingAssetTask } from '../../assets'
import { movieExternalIds, movieTagLinks, movies, type NewMovie } from '@shared/db'
import type { MovieLinkKind, MovieUpdatePlan, UpdateLinkApplyResult } from '../types'
import { applyMediaRelationFacts } from '../../media-relations'
import {
  applyMediaLinkGraph,
  replaceEntityExternalIds,
  replaceEntityTags,
  type ExternalIdRowSpec,
  type TagLinkRowSpec
} from './links'

const MOVIE_EXTERNAL_ID_SPEC: ExternalIdRowSpec = {
  table: movieExternalIds,
  entityIdColumn: movieExternalIds.movieId,
  entityIdField: 'movieId',
  orderField: 'orderInMovie'
}

const MOVIE_TAG_LINK_SPEC: TagLinkRowSpec = {
  table: movieTagLinks,
  entityIdColumn: movieTagLinks.movieId,
  entityIdField: 'movieId',
  orderInEntityField: 'orderInMovie'
}

export function applyMoviePlan(
  tx: DbContext,
  movieId: string,
  plan: MovieUpdatePlan,
  persistHandlers: IngestPersistHandlers
): UpdateLinkApplyResult<MovieLinkKind> {
  if (plan.externalIds) {
    requireExternalIdsAvailable(tx, movieExternalIdLink, [movieId], plan.externalIds)
    replaceEntityExternalIds(tx, MOVIE_EXTERNAL_ID_SPEC, movieId, plan.externalIds)
  }

  if (plan.tags) {
    replaceEntityTags(tx, MOVIE_TAG_LINK_SPEC, movieId, plan.tags)
  }

  if (Object.keys(plan.patch).length > 0) {
    tx.update(movies)
      .set(plan.patch as Partial<NewMovie>)
      .where(eq(movies.id, movieId))
      .run()
  }

  const plannedMedia: Array<[string, string | undefined]> = [
    ['coverFile', plan.coverUrl],
    ['backdropFile', plan.backdropUrl],
    ['logoFile', plan.logoUrl]
  ]
  const pendingAssets: PendingAssetTask[] = plannedMedia
    .filter(([, url]) => Boolean(url))
    .map(([field, url]) => ({ table: 'movies', rowId: movieId, field, url: url as string }))

  const relationGraph = plan.relationGraph
  const relations = relationGraph
    ? applyMediaLinkGraph({
        tx,
        entityId: movieId,
        persistHandlers,
        nodes: relationGraph,
        person: {
          kind: 'moviePerson',
          mode: plan.links.moviePerson,
          links: relationGraph.links.moviePerson
        },
        company: {
          kind: 'movieCompany',
          mode: plan.links.movieCompany,
          links: relationGraph.links.movieCompany
        },
        character: {
          kind: 'movieCharacter',
          mode: plan.links.movieCharacter,
          links: relationGraph.links.movieCharacter
        },
        characterPerson: {
          mode: plan.links.characterPerson,
          links: relationGraph.links.characterPerson
        }
      })
    : { pendingAssets: [] as PendingAssetTask[], preservedLinkRows: {} }
  pendingAssets.push(...relations.pendingAssets)

  let unresolvedRelatedEntries: number | undefined
  if (plan.relatedEntries) {
    const relatedResult = applyMediaRelationFacts({
      tx,
      mediaType: 'movie',
      entityId: movieId,
      facts: plan.relatedEntries.facts,
      collectionMode: plan.relatedEntries.mode
    })
    if (relatedResult.unresolvedCount > 0) {
      unresolvedRelatedEntries = relatedResult.unresolvedCount
    }
  }

  return {
    pendingAssets,
    preservedLinkRows: relations.preservedLinkRows,
    ...(unresolvedRelatedEntries !== undefined && { unresolvedRelatedEntries })
  }
}
