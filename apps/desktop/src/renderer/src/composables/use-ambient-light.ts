/**
 * Ambient light binding for cover-driven pages.
 *
 * Extracts a raw ambient palette from the given cover URL and feeds the
 * ambient light controller (page scope: the palette drives the lightbox
 * light layer). Pages without a usable cover (or extraction misses) fall
 * back to the active theme's light tokens. Clears on scope dispose; the
 * controller's grace period lets the next detail page take over without
 * flashing the default light.
 */

import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { extractAmbientPalette, lightController } from '@renderer/core/theme'

export function useAmbientLight(coverUrl: MaybeRefOrGetter<string | null>): void {
  let runId = 0

  watch(
    () => toValue(coverUrl),
    (url) => {
      const current = ++runId
      if (!url) {
        lightController.clear()
        return
      }

      void extractAmbientPalette(url).then((palette) => {
        if (current !== runId) return
        if (palette) {
          lightController.set(palette)
        } else {
          lightController.clear()
        }
      })
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    runId++
    lightController.clear()
  })
}
