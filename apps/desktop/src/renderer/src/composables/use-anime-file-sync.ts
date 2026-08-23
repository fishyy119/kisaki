/**
 * Anime file sync invocation with user feedback.
 *
 * Wraps the `media-files:sync-anime` call with the shared success, warning,
 * and failure notifications so every sync entry point reports the same way.
 */

import { ref, type Ref } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useI18n } from './use-i18n'

const log = createLogger('Anime')

export interface AnimeFileSync {
  isSyncing: Ref<boolean>
  syncFiles: (animeId: string) => Promise<void>
}

export function useAnimeFileSync(): AnimeFileSync {
  const { m } = useI18n()
  const isSyncing = ref(false)

  async function syncFiles(animeId: string): Promise<void> {
    if (isSyncing.value) return

    isSyncing.value = true
    try {
      const result = await ipcManager.invoke('media-files:sync-anime', { animeId })
      if (!result.success) {
        notify.error(m.value.anime.episodes.syncFailed, result.error)
        return
      }

      notify.success(
        m.value.anime.episodes.syncCompleted({
          episodes: result.data.episodeCount,
          files: result.data.fileCount,
          extras: result.data.extraCount
        })
      )
      if (result.data.unrecognizedFiles.length > 0) {
        notify.warning(
          m.value.anime.episodes.syncUnrecognized({
            count: result.data.unrecognizedFiles.length
          })
        )
      }
    } catch (error) {
      log.error('File sync failed:', error)
      notify.error(m.value.anime.episodes.syncFailed)
    } finally {
      isSyncing.value = false
    }
  }

  return { isSyncing, syncFiles }
}
