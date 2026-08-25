/**
 * Novel file sync invocation with user feedback.
 *
 * Wraps the `holdings:sync-novel` call with the shared success, warning,
 * and failure notifications so every sync entry point reports the same way.
 */

import { ref, type Ref } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useI18n } from './use-i18n'

const log = createLogger('Novel')

export interface NovelFileSync {
  isSyncing: Ref<boolean>
  syncFiles: (novelId: string) => Promise<void>
}

export function useNovelFileSync(): NovelFileSync {
  const { m } = useI18n()
  const isSyncing = ref(false)

  async function syncFiles(novelId: string): Promise<void> {
    if (isSyncing.value) return

    isSyncing.value = true
    try {
      const result = await ipcManager.invoke('holdings:sync-novel', { novelId })
      if (!result.success) {
        notify.error(m.value.novel.volumes.syncFailed, result.error)
        return
      }

      notify.success(
        m.value.novel.volumes.syncCompleted({
          volumes: result.data.volumeCount,
          files: result.data.fileCount
        })
      )
      if (result.data.unrecognizedFiles.length > 0) {
        notify.warning(
          m.value.novel.volumes.syncUnrecognized({
            count: result.data.unrecognizedFiles.length
          })
        )
      }
    } catch (error) {
      log.error('File sync failed:', error)
      notify.error(m.value.novel.volumes.syncFailed)
    } finally {
      isSyncing.value = false
    }
  }

  return { isSyncing, syncFiles }
}
