import { eq } from 'drizzle-orm'
import { animeExternalIds, animeTagLinks, animes, tags } from '@shared/db'
import type { DbContext } from '@main/services/db'
import type { Tag } from '@shared/metadata'
import type { ExternalId } from '@shared/identity'
import type { AnimeCurrentState, UpdateCurrentSelection } from '../types'
import type { AnimeUpdateCoreSurface } from '@shared/ingest/update'

export function loadAnimeCurrent(
  tx: DbContext,
  animeId: string,
  selection: UpdateCurrentSelection<AnimeUpdateCoreSurface>
): AnimeCurrentState {
  const anime = tx.select().from(animes).where(eq(animes.id, animeId)).limit(1).all()[0]
  if (!anime) {
    throw new Error(`Anime not found: ${animeId}`)
  }

  const coreSurfaces = new Set(selection.coreSurfaces)

  const externalIds: ExternalId[] = coreSurfaces.has('externalIds')
    ? tx
        .select()
        .from(animeExternalIds)
        .where(eq(animeExternalIds.animeId, animeId))
        .all()
        .map((row) => ({ source: row.source, id: row.externalId }))
    : []

  const tagsValue: Tag[] = coreSurfaces.has('tags')
    ? tx
        .select()
        .from(animeTagLinks)
        .innerJoin(tags, eq(animeTagLinks.tagId, tags.id))
        .where(eq(animeTagLinks.animeId, animeId))
        .all()
        .map((row) => ({
          name: row.tags.name,
          isNsfw: row.tags.isNsfw,
          isSpoiler: row.anime_tag_links.isSpoiler,
          note: row.anime_tag_links.note ?? undefined
        }))
    : []

  return {
    anime,
    externalIds,
    tags: tagsValue
  }
}
