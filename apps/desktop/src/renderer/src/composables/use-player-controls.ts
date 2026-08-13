/**
 * Transport controls for one live player session.
 *
 * Wraps the `player:*` pause/resume channels with pending state, paused
 * derivation, and failure notifications, so every playback row shares one
 * control path instead of hand-rolling IPC calls.
 */

import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import type { PlaybackStatus } from '@shared/player'
import { useI18n } from './use-i18n'

const log = createLogger('Player')

export interface PlayerControls {
  isPaused: ComputedRef<boolean>
  isPending: Ref<boolean>
  togglePause: () => Promise<void>
}

export function usePlayerControls(options: {
  sessionId: MaybeRefOrGetter<string | undefined>
  status: MaybeRefOrGetter<PlaybackStatus | undefined>
}): PlayerControls {
  const { m } = useI18n()

  const isPaused = computed(() => toValue(options.status) === 'paused')
  const isPending = ref(false)

  async function togglePause(): Promise<void> {
    const sessionId = toValue(options.sessionId)
    if (!sessionId || isPending.value) return

    const resume = isPaused.value
    isPending.value = true
    try {
      const result = resume
        ? await ipcManager.invoke('player:resume', sessionId)
        : await ipcManager.invoke('player:pause', sessionId)
      if (!result.success) {
        notifyFailure(resume, result.error)
      }
    } catch (error) {
      // Raw transport errors go to the log alone; the notice stays wrapped.
      log.error('player control call threw:', error)
      notifyFailure(resume)
    } finally {
      isPending.value = false
    }
  }

  function notifyFailure(resume: boolean, error?: string): void {
    const messages = m.value.anime.player
    notify.error(resume ? messages.resumeFailed : messages.pauseFailed, error)
  }

  return { isPaused, isPending, togglePause }
}
