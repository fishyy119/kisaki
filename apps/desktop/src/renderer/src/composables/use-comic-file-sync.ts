/**
 * Comic file sync invocation with user feedback.
 *
 * Binds the shared file-sync shell to `holdings:sync-comic` and the comic
 * chapter wording.
 */

import { ipcManager } from '@renderer/core/ipc'
import { createFileSyncComposable, type FileSyncComposable } from './use-file-sync'

export type ComicFileSync = FileSyncComposable

export const useComicFileSync = createFileSyncComposable({
  logDomain: 'Comic',
  invoke: (comicId) => ipcManager.invoke('holdings:sync-comic', { comicId }),
  texts: (messages) => ({
    failed: messages.comic.chapters.syncFailed,
    completed: (result) =>
      messages.comic.chapters.syncCompleted({
        chapters: result.chapterCount,
        files: result.fileCount
      }),
    unrecognized: (count) => messages.comic.chapters.syncUnrecognized({ count })
  })
})
