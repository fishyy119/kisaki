import { shallowRef, type ShallowRef } from 'vue'
import type { AmbientPalette } from './extraction'

/**
 * Delay before a cleared palette falls back to the theme's light tokens.
 * A set() inside this window (detail-to-detail navigation) cancels the
 * fallback so the lamp cross-fades directly between page palettes instead
 * of flashing through the default light.
 */
const CLEAR_GRACE_MS = 300

/**
 * Ambient light has exactly one scope: the page. This controller holds the
 * page-level dynamic (cover-derived) raw palette as reactive state;
 * AmbientLight is the only consumer and converges it for the active mode at
 * render time. Clearing falls back to the theme's light tokens after a short
 * grace period.
 */
class LightController {
  private readonly state = shallowRef<AmbientPalette | null>(null)
  private clearTimer: ReturnType<typeof setTimeout> | null = null

  /** Active page palette, or null when the theme's light tokens apply. */
  readonly palette: Readonly<ShallowRef<AmbientPalette | null>> = this.state

  set(palette: AmbientPalette): void {
    this.cancelPendingClear()
    this.state.value = palette
  }

  clear(): void {
    if (this.clearTimer !== null || this.state.value === null) return
    this.clearTimer = setTimeout(() => {
      this.clearTimer = null
      this.state.value = null
    }, CLEAR_GRACE_MS)
  }

  private cancelPendingClear(): void {
    if (this.clearTimer === null) return
    clearTimeout(this.clearTimer)
    this.clearTimer = null
  }
}

export const lightController = new LightController()
