/**
 * Comic file sync invocation with user feedback.
 *
 * Wraps the `media-files:sync-comic` call with the shared success, warning,
 * and failure notifications so every sync entry point reports the same way.
 */

import { ref, type Ref } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useI18n } from './use-i18n'

const log = createLogger('Comic')

export interface ComicFileSync {
  isSyncing: Ref<boolean>
  syncFiles: (comicId: string) => Promise<void>
}

export function useComicFileSync(): ComicFileSync {
  const { m } = useI18n()
  const isSyncing = ref(false)

  async function syncFiles(comicId: string): Promise<void> {
    if (isSyncing.value) return

    isSyncing.value = true
    try {
      const result = await ipcManager.invoke('media-files:sync-comic', { comicId })
      if (!result.success) {
        notify.error(m.value.comic.chapters.syncFailed, result.error)
        return
      }

      notify.success(
        m.value.comic.chapters.syncCompleted({
          chapters: result.data.chapterCount,
          files: result.data.fileCount
        })
      )
      if (result.data.unrecognizedFiles.length > 0) {
        notify.warning(
          m.value.comic.chapters.syncUnrecognized({
            count: result.data.unrecognizedFiles.length
          })
        )
      }
    } catch (error) {
      log.error('File sync failed:', error)
      notify.error(m.value.comic.chapters.syncFailed)
    } finally {
      isSyncing.value = false
    }
  }

  return { isSyncing, syncFiles }
}
