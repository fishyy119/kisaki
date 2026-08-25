/**
 * Reading entry point of one comic: starts (or refocuses) the reader window
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

const log = createLogger('Comic')

export interface ComicReading {
  isStartPending: Ref<boolean>
  /** Opens the reader at the unit (or the next unread one), optionally at a file. */
  read: (chapterId?: string, fileId?: string) => Promise<void>
}

export function useComicReading(comicId: MaybeRefOrGetter<string>): ComicReading {
  const { m } = useI18n()
  const isStartPending = ref(false)

  async function read(chapterId?: string, fileId?: string): Promise<void> {
    if (isStartPending.value) return

    isStartPending.value = true
    try {
      const result = await ipcManager.invoke(
        'activity:read-comic',
        toValue(comicId),
        chapterId,
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
      log.error('comic read call threw:', error)
      notify.error(m.value.activity.readFailedTitle)
    } finally {
      isStartPending.value = false
    }
  }

  return { isStartPending, read }
}
