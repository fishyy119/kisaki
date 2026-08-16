/**
 * Movie file sync invocation with user feedback.
 *
 * Wraps the `ingest:sync-movie-files` call with the shared success and failure
 * notifications so every sync entry point reports the same way.
 */

import { ref, type Ref } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useI18n } from './use-i18n'

const log = createLogger('Movie')

export interface MovieFileSync {
  isSyncing: Ref<boolean>
  syncFiles: (movieId: string) => Promise<void>
}

export function useMovieFileSync(): MovieFileSync {
  const { m } = useI18n()
  const isSyncing = ref(false)

  async function syncFiles(movieId: string): Promise<void> {
    if (isSyncing.value) return

    isSyncing.value = true
    try {
      const result = await ipcManager.invoke('ingest:sync-movie-files', { movieId })
      if (!result.success) {
        notify.error(m.value.movie.files.syncFailed, result.error)
        return
      }

      notify.success(
        m.value.movie.files.syncCompleted({
          files: result.data.fileCount,
          extras: result.data.extraCount
        })
      )
    } catch (error) {
      log.error('File sync failed:', error)
      notify.error(m.value.movie.files.syncFailed)
    } finally {
      isSyncing.value = false
    }
  }

  return { isSyncing, syncFiles }
}
