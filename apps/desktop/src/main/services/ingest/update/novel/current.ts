import { eq } from 'drizzle-orm'
import { novelExternalIds, novelTagLinks, novels, tags } from '@shared/db'
import type { DbContext } from '@main/services/db'
import type { Tag } from '@shared/metadata'
import type { ExternalId } from '@shared/identity'
import type { NovelCurrentState } from './types'
import type { UpdateCurrentSelection } from '../types'
import type { NovelUpdateCoreSurface } from '@shared/ingest/update'

export function loadNovelCurrent(
  tx: DbContext,
  novelId: string,
  selection: UpdateCurrentSelection<NovelUpdateCoreSurface>
): NovelCurrentState {
  const novel = tx.select().from(novels).where(eq(novels.id, novelId)).limit(1).all()[0]
  if (!novel) {
    throw new Error(`Novel not found: ${novelId}`)
  }

  const coreSurfaces = new Set(selection.coreSurfaces)

  const externalIds: ExternalId[] = coreSurfaces.has('externalIds')
    ? tx
        .select()
        .from(novelExternalIds)
        .where(eq(novelExternalIds.novelId, novelId))
        .all()
        .map((row) => ({ source: row.source, id: row.externalId }))
    : []

  const tagsValue: Tag[] = coreSurfaces.has('tags')
    ? tx
        .select()
        .from(novelTagLinks)
        .innerJoin(tags, eq(novelTagLinks.tagId, tags.id))
        .where(eq(novelTagLinks.novelId, novelId))
        .all()
        .map((row) => ({
          name: row.tags.name,
          isNsfw: row.tags.isNsfw,
          isSpoiler: row.novel_tag_links.isSpoiler,
          note: row.novel_tag_links.note ?? undefined
        }))
    : []

  return {
    novel,
    externalIds,
    tags: tagsValue
  }
}
