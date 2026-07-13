import { shallowRef } from 'vue'

export type AmbientLightColors = readonly [string, string, string]

/**
 * Runtime state for the ambient light layer.
 *
 * Holds dynamic (content-derived) ambient colors. When null, the layer falls
 * back to the active theme's --light-* tokens.
 */
class LightController {
  readonly colors = shallowRef<AmbientLightColors | null>(null)

  set(colors: AmbientLightColors): void {
    this.colors.value = colors
  }

  clear(): void {
    this.colors.value = null
  }
}

export const lightController = new LightController()
