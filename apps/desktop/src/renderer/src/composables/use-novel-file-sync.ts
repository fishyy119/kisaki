/**
 * Novel file sync invocation with user feedback.
 *
 * Binds the shared file-sync shell to `holdings:sync-novel` and the novel
 * volume wording.
 */

import { ipcManager } from '@renderer/core/ipc'
import { createFileSyncComposable, type FileSyncComposable } from './use-file-sync'

export type NovelFileSync = FileSyncComposable

export const useNovelFileSync = createFileSyncComposable({
  logDomain: 'Novel',
  invoke: (novelId) => ipcManager.invoke('holdings:sync-novel', { novelId }),
  texts: (messages) => ({
    failed: messages.novel.volumes.syncFailed,
    completed: (result) =>
      messages.novel.volumes.syncCompleted({
        volumes: result.volumeCount,
        files: result.fileCount
      }),
    unrecognized: (count) => messages.novel.volumes.syncUnrecognized({ count })
  })
})
