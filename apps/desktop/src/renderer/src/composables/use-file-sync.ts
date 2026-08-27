/**
 * File sync invocation shell shared by the per-media sync composables.
 *
 * Wraps a holdings sync call with the shared guard, success, warning, and
 * failure notifications so every sync entry point reports the same way. The
 * per-media composable states its channel and wording.
 */

import { ref, type Ref } from 'vue'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import type { IpcError, IpcSuccess } from '@shared/ipc'
import type { Messages } from '@shared/i18n'
import { useI18n } from './use-i18n'

export interface FileSyncComposable {
  isSyncing: Ref<boolean>
  syncFiles: (entityId: string) => Promise<void>
}

export interface FileSyncSpec<TResult extends { unrecognizedFiles: string[] }> {
  /** Log prefix domain, matching the media's renderer logger. */
  logDomain: string
  invoke(entityId: string): Promise<IpcSuccess<TResult> | IpcError>
  texts(messages: Messages): {
    failed: string
    completed(result: TResult): string
    unrecognized(count: number): string
  }
}

export function createFileSyncComposable<TResult extends { unrecognizedFiles: string[] }>(
  spec: FileSyncSpec<TResult>
): () => FileSyncComposable {
  const log = createLogger(spec.logDomain)

  return function useFileSync(): FileSyncComposable {
    const { m } = useI18n()
    const isSyncing = ref(false)

    async function syncFiles(entityId: string): Promise<void> {
      if (isSyncing.value) return

      isSyncing.value = true
      try {
        const texts = spec.texts(m.value)
        const result = await spec.invoke(entityId)
        if (!result.success) {
          notify.error(texts.failed, result.error)
          return
        }

        notify.success(texts.completed(result.data))
        if (result.data.unrecognizedFiles.length > 0) {
          notify.warning(texts.unrecognized(result.data.unrecognizedFiles.length))
        }
      } catch (error) {
        log.error('File sync failed.', error)
        notify.error(spec.texts(m.value).failed)
      } finally {
        isSyncing.value = false
      }
    }

    return { isSyncing, syncFiles }
  }
}
