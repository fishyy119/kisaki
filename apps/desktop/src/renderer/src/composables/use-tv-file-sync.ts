/**
 * Tv file sync invocation with user feedback.
 *
 * Wraps the `ingest:sync-tv-files` call with the shared success, warning, and
 * failure notifications so every sync entry point reports the same way.
 */

import { ref, type Ref } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useI18n } from './use-i18n'

const log = createLogger('Tv')

export interface TvFileSync {
  isSyncing: Ref<boolean>
  syncFiles: (tvId: string) => Promise<void>
}

export function useTvFileSync(): TvFileSync {
  const { m } = useI18n()
  const isSyncing = ref(false)

  async function syncFiles(tvId: string): Promise<void> {
    if (isSyncing.value) return

    isSyncing.value = true
    try {
      const result = await ipcManager.invoke('ingest:sync-tv-files', { tvId })
      if (!result.success) {
        notify.error(m.value.tv.episodes.syncFailed, result.error)
        return
      }

      notify.success(
        m.value.tv.episodes.syncCompleted({
          seasons: result.data.seasonCount,
          episodes: result.data.episodeCount,
          files: result.data.fileCount,
          extras: result.data.extraCount
        })
      )
      if (result.data.unrecognizedFiles.length > 0) {
        notify.warning(
          m.value.tv.episodes.syncUnrecognized({
            count: result.data.unrecognizedFiles.length
          })
        )
      }
    } catch (error) {
      log.error('File sync failed:', error)
      notify.error(m.value.tv.episodes.syncFailed)
    } finally {
      isSyncing.value = false
    }
  }

  return { isSyncing, syncFiles }
}
