/**
 * What auto sync needs to know about comic libraries.
 *
 * The watch mechanism itself lives in the shared coordinator; this only names
 * the comic directory column, the files worth reacting to, and how one entry
 * reconciles. Watching one level below the walk cap is deliberate: a directory
 * container is itself a unit, so its pages change one level deeper than the
 * deepest unit the walk resolves.
 */

import { isNotNull } from 'drizzle-orm'
import type { DbService } from '@main/services/db'
import { comics } from '@shared/db'
import type { AutoSyncSpec } from '../auto-sync'
import { isComicArchiveFile, isComicPageFile } from './recognition'
import { MAX_COMIC_WALK_DEPTH, type ComicFileSyncCoordinator } from './sync'

export function comicAutoSyncSpec(
  dbService: DbService,
  sync: ComicFileSyncCoordinator
): AutoSyncSpec {
  return {
    mediaType: 'comic',
    entryTable: 'comics',
    depth: MAX_COMIC_WALK_DEPTH + 1,
    matchesFile: (filePath) => isComicArchiveFile(filePath) || isComicPageFile(filePath),
    readDirectories: () =>
      dbService.client
        .select({ id: comics.id, dirPath: comics.dirPath })
        .from(comics)
        .where(isNotNull(comics.dirPath))
        .all(),
    sync: async (comicId) => {
      const result = await sync.sync({ comicId })
      return { chapterCount: result.chapterCount, fileCount: result.fileCount }
    }
  }
}
