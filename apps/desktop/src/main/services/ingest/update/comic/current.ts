import { eq } from 'drizzle-orm'
import { comicExternalIds, comicTagLinks, comics, tags } from '@shared/db'
import type { DbContext } from '@main/services/db'
import type { Tag } from '@shared/metadata'
import type { ExternalId } from '@shared/identity'
import type { ComicCurrentState } from './types'
import type { UpdateCurrentSelection } from '../types'
import type { ComicUpdateCoreSurface } from '@shared/ingest/update'

export function loadComicCurrent(
  tx: DbContext,
  comicId: string,
  selection: UpdateCurrentSelection<ComicUpdateCoreSurface>
): ComicCurrentState {
  const comic = tx.select().from(comics).where(eq(comics.id, comicId)).limit(1).all()[0]
  if (!comic) {
    throw new Error(`Comic not found: ${comicId}`)
  }

  const coreSurfaces = new Set(selection.coreSurfaces)

  const externalIds: ExternalId[] = coreSurfaces.has('externalIds')
    ? tx
        .select()
        .from(comicExternalIds)
        .where(eq(comicExternalIds.comicId, comicId))
        .all()
        .map((row) => ({ source: row.source, id: row.externalId }))
    : []

  const tagsValue: Tag[] = coreSurfaces.has('tags')
    ? tx
        .select()
        .from(comicTagLinks)
        .innerJoin(tags, eq(comicTagLinks.tagId, tags.id))
        .where(eq(comicTagLinks.comicId, comicId))
        .all()
        .map((row) => ({
          name: row.tags.name,
          isNsfw: row.tags.isNsfw,
          isSpoiler: row.comic_tag_links.isSpoiler,
          note: row.comic_tag_links.note ?? undefined
        }))
    : []

  return {
    comic,
    externalIds,
    tags: tagsValue
  }
}
