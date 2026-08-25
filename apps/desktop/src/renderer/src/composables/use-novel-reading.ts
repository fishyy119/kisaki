/**
 * Reading entry point of one novel: starts (or refocuses) the reader window
 * through the activity service. Closing the reader window is the stop, so the
 * facade only carries the start transport. Confirmed outcomes show through
 * the opened window; only failures notify, and raw transport errors go to the
 * log alone.
 */

import { ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useI18n } from './use-i18n'

const log = createLogger('Novel')

export interface NovelReading {
  isStartPending: Ref<boolean>
  /** Opens the reader at the volume (or the next unread one), optionally at a file. */
  read: (volumeId?: string, fileId?: string) => Promise<void>
}

export function useNovelReading(novelId: MaybeRefOrGetter<string>): NovelReading {
  const { m } = useI18n()
  const isStartPending = ref(false)

  async function read(volumeId?: string, fileId?: string): Promise<void> {
    if (isStartPending.value) return

    isStartPending.value = true
    try {
      const result = await ipcManager.invoke(
        'activity:read-novel',
        toValue(novelId),
        volumeId,
        fileId
      )
      if (!result.success) {
        notify.error(m.value.activity.readFailedTitle, result.error)
        return
      }
      if (result.data.status === 'failed') {
        notify.error(m.value.activity.readFailedTitle, m.value.activity.errors[result.data.reason])
      }
    } catch (error) {
      log.error('novel read call threw:', error)
      notify.error(m.value.activity.readFailedTitle)
    } finally {
      isStartPending.value = false
    }
  }

  return { isStartPending, read }
}
