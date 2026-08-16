import { eq } from 'drizzle-orm'
import { movieExternalIds, movieTagLinks, movies, tags } from '@shared/db'
import type { DbContext } from '@main/services/db'
import type { Tag } from '@shared/metadata'
import type { ExternalId } from '@shared/identity'
import type { MovieCurrentState, UpdateCurrentSelection } from '../types'
import type { MovieUpdateCoreSurface } from '@shared/ingest/update'

export function loadMovieCurrent(
  tx: DbContext,
  movieId: string,
  selection: UpdateCurrentSelection<MovieUpdateCoreSurface>
): MovieCurrentState {
  const movie = tx.select().from(movies).where(eq(movies.id, movieId)).limit(1).all()[0]
  if (!movie) {
    throw new Error(`Movie not found: ${movieId}`)
  }

  const coreSurfaces = new Set(selection.coreSurfaces)

  const externalIds: ExternalId[] = coreSurfaces.has('externalIds')
    ? tx
        .select()
        .from(movieExternalIds)
        .where(eq(movieExternalIds.movieId, movieId))
        .all()
        .map((row) => ({ source: row.source, id: row.externalId }))
    : []

  const tagsValue: Tag[] = coreSurfaces.has('tags')
    ? tx
        .select()
        .from(movieTagLinks)
        .innerJoin(tags, eq(movieTagLinks.tagId, tags.id))
        .where(eq(movieTagLinks.movieId, movieId))
        .all()
        .map((row) => ({
          name: row.tags.name,
          isNsfw: row.tags.isNsfw,
          isSpoiler: row.movie_tag_links.isSpoiler,
          note: row.movie_tag_links.note ?? undefined
        }))
    : []

  return {
    movie,
    externalIds,
    tags: tagsValue
  }
}
