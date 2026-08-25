/**
 * What auto sync needs to know about novel libraries.
 *
 * The watch mechanism itself lives in the shared coordinator; this only names
 * the novel directory column, the files worth reacting to, and how one entry
 * reconciles.
 */

import { isNotNull } from 'drizzle-orm'
import type { DbService } from '@main/services/db'
import { novels } from '@shared/db'
import type { AutoSyncSpec } from '../auto-sync'
import { isNovelBookFile } from './recognition'
import { MAX_NOVEL_WALK_DEPTH, type NovelFileSyncHandler } from './sync'

export function novelAutoSyncSpec(dbService: DbService, sync: NovelFileSyncHandler): AutoSyncSpec {
  return {
    mediaType: 'novel',
    entryTable: 'novels',
    depth: MAX_NOVEL_WALK_DEPTH,
    matchesFile: isNovelBookFile,
    readDirectories: () =>
      dbService.client
        .select({ id: novels.id, dirPath: novels.novelDirPath })
        .from(novels)
        .where(isNotNull(novels.novelDirPath))
        .all(),
    sync: async (novelId) => {
      const result = await sync.sync({ novelId })
      return { volumeCount: result.volumeCount, fileCount: result.fileCount }
    }
  }
}
