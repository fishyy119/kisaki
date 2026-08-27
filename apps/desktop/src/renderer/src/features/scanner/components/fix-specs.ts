/**
 * Scanner fix re-add submissions.
 *
 * One entry per media type binds the scanned directory to that media's ingest
 * add channel. The fix dialog's update path is media-neutral through
 * `METADATA_UPDATE_SPECS`; the add path lives here because the directory
 * option key is per-media domain naming.
 */

import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import type { MediaType } from '@shared/common'
import type { ScraperLookup } from '@shared/scraper'

export interface ScannerFixAddOptions {
  dirPath: string
  targetCollectionId?: string
}

type ScannerFixAddSubmit = (
  profileId: string,
  lookup: ScraperLookup,
  options: ScannerFixAddOptions
) => Promise<unknown>

export const SCANNER_FIX_ADD_SPECS: Record<MediaType, ScannerFixAddSubmit> = {
  game: async (profileId, lookup, options) =>
    unwrapIpcData(
      await ipcManager.invoke('ingest:add-game-from-scraper', profileId, lookup, {
        gameDirPath: options.dirPath,
        targetCollectionId: options.targetCollectionId
      })
    ),
  anime: async (profileId, lookup, options) =>
    unwrapIpcData(
      await ipcManager.invoke('ingest:add-anime-from-scraper', profileId, lookup, {
        animeDirPath: options.dirPath,
        targetCollectionId: options.targetCollectionId
      })
    ),
  comic: async (profileId, lookup, options) =>
    unwrapIpcData(
      await ipcManager.invoke('ingest:add-comic-from-scraper', profileId, lookup, {
        comicDirPath: options.dirPath,
        targetCollectionId: options.targetCollectionId
      })
    ),
  novel: async (profileId, lookup, options) =>
    unwrapIpcData(
      await ipcManager.invoke('ingest:add-novel-from-scraper', profileId, lookup, {
        novelDirPath: options.dirPath,
        targetCollectionId: options.targetCollectionId
      })
    )
}
