export type AmbientLightColors = readonly [string, string, string]

const LIGHT_VARS = ['--light-1', '--light-2', '--light-3'] as const

/**
 * Ambient light has exactly one scope: the page. This controller applies
 * page-level dynamic (cover-derived) colors as --light-* overrides on the
 * document root; the light layer of the lightbox (.glow) is the only
 * consumer. Clearing falls back to the theme's light tokens.
 */
class LightController {
  set(colors: AmbientLightColors): void {
    for (const [index, name] of LIGHT_VARS.entries()) {
      document.documentElement.style.setProperty(name, colors[index] ?? '')
    }
  }

  clear(): void {
    for (const name of LIGHT_VARS) {
      document.documentElement.style.removeProperty(name)
    }
  }
}

export const lightController = new LightController()
