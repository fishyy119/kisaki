import { shallowRef, type ShallowRef } from 'vue'

export type AmbientLightColors = readonly [string, string, string]

/**
 * Ambient light has exactly one scope: the page. This controller holds the
 * page-level dynamic (cover-derived) palette as reactive state; AmbientLight
 * is the only consumer and renders each palette as its own glow sheet,
 * cross-fading sheets on change. Clearing falls back to the theme's light
 * tokens.
 */
class LightController {
  private readonly state = shallowRef<AmbientLightColors | null>(null)

  /** Active page palette, or null when the theme's light tokens apply. */
  readonly colors: Readonly<ShallowRef<AmbientLightColors | null>> = this.state

  set(colors: AmbientLightColors): void {
    this.state.value = colors
  }

  clear(): void {
    this.state.value = null
  }
}

export const lightController = new LightController()
