/**
 * Anime file sync invocation with user feedback.
 *
 * Binds the shared file-sync shell to `holdings:sync-anime` and the anime
 * episode wording.
 */

import { ipcManager } from '@renderer/core/ipc'
import { createFileSyncComposable } from './use-file-sync'

export const useAnimeFileSync = createFileSyncComposable({
  logDomain: 'Anime',
  invoke: (animeId) => ipcManager.invoke('holdings:sync-anime', { animeId }),
  texts: (messages) => ({
    failed: messages.anime.episodes.syncFailed,
    completed: (result) =>
      messages.anime.episodes.syncCompleted({
        episodes: result.episodeCount,
        files: result.fileCount,
        extras: result.extraCount
      }),
    unrecognized: (count) => messages.anime.episodes.syncUnrecognized({ count })
  })
})
