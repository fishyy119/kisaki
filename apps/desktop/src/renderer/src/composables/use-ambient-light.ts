/**
 * Ambient light binding for cover-driven pages.
 *
 * Extracts ambient colors from the given cover URL and feeds the ambient
 * light controller (page scope: the palette drives the lightbox light
 * layer). Pages without a usable cover (or extraction misses) fall back to
 * the active theme's light tokens. Clears on scope dispose.
 */

import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { extractAmbientLightColors, lightController } from '@renderer/core/theme'

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

      void extractAmbientLightColors(url).then((colors) => {
        if (current !== runId) return
        if (colors) {
          lightController.set(colors)
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
