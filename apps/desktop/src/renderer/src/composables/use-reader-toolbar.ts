/**
 * Auto-hiding reader toolbar state: visible on pointer activity, hidden after
 * a short idle so the page owns the screen while actually reading.
 */

import { onBeforeUnmount, ref, type Ref } from 'vue'

const IDLE_HIDE_MS = 2_500

export function useReaderToolbar(): {
  toolbarVisible: Ref<boolean>
  wakeToolbar: () => void
} {
  const toolbarVisible = ref(true)
  let hideTimer: ReturnType<typeof setTimeout> | null = null

  function wakeToolbar(): void {
    toolbarVisible.value = true
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      toolbarVisible.value = false
    }, IDLE_HIDE_MS)
  }

  wakeToolbar()

  onBeforeUnmount(() => {
    if (hideTimer) clearTimeout(hideTimer)
  })

  return { toolbarVisible, wakeToolbar }
}
