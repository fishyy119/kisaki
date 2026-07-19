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
 * Page-scoped write handle on the ambient light. Only the newest claim owns
 * the light; calls from a superseded or released claim are ignored, so page
 * lifecycles that overlap (e.g. a route transition keeping the leaving page
 * alive while the next one mounts) can never clear a palette the newer page
 * already set.
 */
export interface AmbientLightClaim {
  set(palette: AmbientPalette): void
  clear(): void
  /** Drop ownership; clears the light if this claim still owns it. */
  release(): void
}

/**
 * Ambient light has exactly one scope: the page. This controller holds the
 * page-level dynamic (cover-derived) raw palette as reactive state;
 * AmbientLight is the only consumer and converges it for the active mode at
 * render time. Pages write through claims (newest claim wins). Clearing
 * falls back to the theme's light tokens after a short grace period.
 */
class LightController {
  private readonly state = shallowRef<AmbientPalette | null>(null)
  private clearTimer: ReturnType<typeof setTimeout> | null = null
  private activeClaim: symbol | null = null

  /** Active page palette, or null when the theme's light tokens apply. */
  readonly palette: Readonly<ShallowRef<AmbientPalette | null>> = this.state

  claim(): AmbientLightClaim {
    const token = Symbol('ambient-light-claim')
    this.activeClaim = token

    return {
      set: (palette) => {
        if (this.activeClaim !== token) return
        this.cancelPendingClear()
        this.state.value = palette
      },
      clear: () => {
        if (this.activeClaim !== token) return
        this.scheduleClear()
      },
      release: () => {
        if (this.activeClaim !== token) return
        this.activeClaim = null
        this.scheduleClear()
      }
    }
  }

  private scheduleClear(): void {
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
