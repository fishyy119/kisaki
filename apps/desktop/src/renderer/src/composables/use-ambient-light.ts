/**
 * Ambient light binding for cover-driven pages.
 *
 * Extracts a raw ambient palette from the given cover URL and feeds the
 * ambient light controller through a page claim (the palette drives the
 * lightbox light layer). Pages without a usable cover (or extraction
 * misses) fall back to the active theme's light tokens. Watch cleanup
 * invalidates in-flight extractions when the cover changes or the scope
 * disposes; claim ownership keeps a disposing page from wiping a newer
 * page's palette, and the controller's grace period lets the next detail
 * page take over without flashing the default light.
 */

import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { extractAmbientPalette, lightController } from '@renderer/core/theme'

export function useAmbientLight(coverUrl: MaybeRefOrGetter<string | null>): void {
  const light = lightController.claim()

  watch(
    () => toValue(coverUrl),
    (url, _previous, onCleanup) => {
      if (!url) {
        light.clear()
        return
      }

      let stale = false
      onCleanup(() => {
        stale = true
      })

      void extractAmbientPalette(url).then((palette) => {
        if (stale) return
        if (palette) {
          light.set(palette)
        } else {
          light.clear()
        }
      })
    },
    { immediate: true }
  )

  onScopeDispose(() => light.release())
}
