import { eq } from 'drizzle-orm'
import { tags, tvExternalIds, tvTagLinks, tvs } from '@shared/db'
import type { DbContext } from '@main/services/db'
import type { Tag } from '@shared/metadata'
import type { ExternalId } from '@shared/identity'
import type { TvCurrentState, UpdateCurrentSelection } from '../types'
import type { TvUpdateCoreSurface } from '@shared/ingest/update'

export function loadTvCurrent(
  tx: DbContext,
  tvId: string,
  selection: UpdateCurrentSelection<TvUpdateCoreSurface>
): TvCurrentState {
  const tv = tx.select().from(tvs).where(eq(tvs.id, tvId)).limit(1).all()[0]
  if (!tv) {
    throw new Error(`TV series not found: ${tvId}`)
  }

  const coreSurfaces = new Set(selection.coreSurfaces)

  const externalIds: ExternalId[] = coreSurfaces.has('externalIds')
    ? tx
        .select()
        .from(tvExternalIds)
        .where(eq(tvExternalIds.tvId, tvId))
        .all()
        .map((row) => ({ source: row.source, id: row.externalId }))
    : []

  const tagsValue: Tag[] = coreSurfaces.has('tags')
    ? tx
        .select()
        .from(tvTagLinks)
        .innerJoin(tags, eq(tvTagLinks.tagId, tags.id))
        .where(eq(tvTagLinks.tvId, tvId))
        .all()
        .map((row) => ({
          name: row.tags.name,
          isNsfw: row.tags.isNsfw,
          isSpoiler: row.tv_tag_links.isSpoiler,
          note: row.tv_tag_links.note ?? undefined
        }))
    : []

  return {
    tv,
    externalIds,
    tags: tagsValue
  }
}
