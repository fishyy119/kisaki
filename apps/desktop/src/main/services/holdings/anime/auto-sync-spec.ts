/**
 * What auto sync needs to know about anime libraries.
 *
 * The watch mechanism itself lives in the shared coordinator; this only names
 * the anime directory column, the files worth reacting to, and how one entry
 * reconciles.
 */

import { isNotNull } from 'drizzle-orm'
import type { DbService } from '@main/services/db'
import { animes } from '@shared/db'
import type { AutoSyncSpec } from '../auto-sync'
import { isVideoFile } from './recognition'
import { MAX_WALK_DEPTH, type AnimeFileSyncCoordinator } from './sync'

export function animeAutoSyncSpec(
  dbService: DbService,
  sync: AnimeFileSyncCoordinator
): AutoSyncSpec {
  return {
    mediaType: 'anime',
    entryTable: 'animes',
    depth: MAX_WALK_DEPTH,
    matchesFile: isVideoFile,
    readDirectories: () =>
      dbService.client
        .select({ id: animes.id, dirPath: animes.dirPath })
        .from(animes)
        .where(isNotNull(animes.dirPath))
        .all(),
    sync: async (animeId) => {
      const result = await sync.sync({ animeId })
      return {
        episodeCount: result.episodeCount,
        fileCount: result.fileCount,
        extraCount: result.extraCount
      }
    }
  }
}
