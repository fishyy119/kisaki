/** Comic unit row persistence shared by the first-write and re-scrape flows. */

import { nanoid } from 'nanoid'
import { normalizeExternalIds, type ExternalId } from '@shared/identity'
import { comicChapterExternalIds, comicChapters } from '@shared/db'
import type { ComicChapterInfo } from '@shared/metadata'
import type { DbContext } from '@main/services/db'

/**
 * Attach external ids to a comic unit row.
 *
 * Conflicts are skipped rather than reassigned: an id already claimed by
 * another unit stays there, mirroring how entity external ids behave.
 */
export function insertComicChapterExternalIds(
  tx: DbContext,
  chapterId: string,
  externalIds: ExternalId[] | undefined,
  startOrder = 0
): void {
  for (const [index, extId] of normalizeExternalIds(externalIds).entries()) {
    tx.insert(comicChapterExternalIds)
      .values({
        chapterId,
        source: extId.source,
        externalId: extId.id,
        orderInChapter: startOrder + index
      })
      .onConflictDoNothing()
      .run()
  }
}

/** Insert one scraped unit row together with its identity, returning its id. */
export function insertComicChapterRow(
  tx: DbContext,
  comicId: string,
  chapter: ComicChapterInfo,
  orderInComic: number
): string {
  const chapterId = nanoid()
  tx.insert(comicChapters)
    .values({
      id: chapterId,
      comicId,
      volumeNumber: chapter.volumeNumber,
      chapterNumber: chapter.chapterNumber,
      name: chapter.name,
      originalName: chapter.originalName,
      releaseDate: chapter.releaseDate,
      description: chapter.description,
      orderInComic
    })
    .run()

  insertComicChapterExternalIds(tx, chapterId, chapter.externalIds)
  return chapterId
}
