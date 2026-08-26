/**
 * Reading time of the current reader window, for the progress footer.
 *
 * A window-local minute counter kept above the chrome so entering full screen
 * does not restart it. The main process already records the authoritative
 * reading sessions, so nothing here is reported or persisted.
 */

import { onBeforeUnmount, ref, type Ref } from 'vue'

/** Well inside a minute, so the shown value is never a minute stale. */
const TICK_MS = 15_000

export function useReadingClock(): { elapsedMinutes: Ref<number> } {
  const startedAt = Date.now()
  const elapsedMinutes = ref(0)

  const timer = setInterval(() => {
    elapsedMinutes.value = Math.floor((Date.now() - startedAt) / 60_000)
  }, TICK_MS)

  onBeforeUnmount(() => {
    clearInterval(timer)
  })

  return { elapsedMinutes }
}
