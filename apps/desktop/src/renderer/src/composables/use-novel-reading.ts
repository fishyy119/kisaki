/**
 * Reading state of one novel entry: the live reader window plus the start and
 * stop transports, so read buttons and unit dialogs share one reading path.
 * Without a unit id the live state reflects any unit of the entry; with one it
 * reflects only that unit. Reading an entry whose window is already open
 * re-aims it, and stop closes the window, which is what ends the session.
 * Confirmed outcomes show through the tracked state; only failures notify, and
 * raw transport errors go to the log alone.
 */

import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useReadingActivityStore } from '@renderer/stores'
import { useI18n } from './use-i18n'

const log = createLogger('Library')

export interface NovelReading {
  isReading: ComputedRef<boolean>
  /** In-flight transport phase, letting buttons render transitional states. */
  pendingAction: Ref<'start' | 'stop' | null>
  /** Opens the reader at the volume (or the next unread one), optionally at a file. */
  read: (fileId?: string) => Promise<void>
  /** Closes the entry's reader window, which is what ends the session. */
  stop: () => Promise<void>
}

export function useNovelReading(
  novelId: MaybeRefOrGetter<string>,
  volumeId?: MaybeRefOrGetter<string | undefined>
): NovelReading {
  const { m } = useI18n()
  const readingActivity = useReadingActivityStore()

  const isReading = computed(() => {
    const volume = toValue(volumeId)
    return volume
      ? readingActivity.getReadingVolumeId(toValue(novelId)) === volume
      : readingActivity.isNovelReading(toValue(novelId))
  })

  const pendingAction = ref<'start' | 'stop' | null>(null)

  async function read(fileId?: string): Promise<void> {
    if (pendingAction.value) return

    pendingAction.value = 'start'
    try {
      const result = await ipcManager.invoke(
        'activity:read-novel',
        toValue(novelId),
        toValue(volumeId),
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
      pendingAction.value = null
    }
  }

  async function stop(): Promise<void> {
    if (pendingAction.value) return

    pendingAction.value = 'stop'
    try {
      const result = await ipcManager.invoke('activity:stop-novel', toValue(novelId))
      if (!result.success) {
        notify.error(m.value.activity.readStopFailedTitle, result.error)
        return
      }
      if (result.data.status === 'failed') {
        notify.error(
          m.value.activity.readStopFailedTitle,
          m.value.activity.errors[result.data.reason]
        )
      }
    } catch (error) {
      log.error('novel stop call threw:', error)
      notify.error(m.value.activity.readStopFailedTitle)
    } finally {
      pendingAction.value = null
    }
  }

  return { isReading, pendingAction, read, stop }
}
