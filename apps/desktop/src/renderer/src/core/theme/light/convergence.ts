/**
 * Mode-aware projection of a raw ambient palette into CSS light colors.
 *
 * Extraction keeps hue anchors honest (including their measured chroma);
 * convergence is where design discipline applies: each mode has an ambient
 * band calibrated against its lamp defaults, and chroma is additionally
 * capped to the sRGB gamut so equal parameters read equally saturated at
 * every hue. Chroma has no floor - a barely-colorful cover yields a
 * barely-colorful light.
 */

import { maxSrgbChroma } from './oklch'
import type { AmbientPalette } from './extraction'

/** Converged CSS oklch colors for the glow sheet, dominant first. */
export type AmbientLightColors = readonly [string, string, string]

/**
 * Per-mode ambient bands, calibrated against the default theme's lamp:
 * light mode keeps the lamp near the paper's lightness so it reads as light,
 * not shadow; dark mode sits above the ink base for a genuine glow.
 */
const AMBIENT_BANDS = {
  light: { minLightness: 0.8, maxLightness: 0.9, maxChroma: 0.11 },
  dark: { minLightness: 0.48, maxLightness: 0.62, maxChroma: 0.12 }
} as const

export function convergeAmbientPalette(
  palette: AmbientPalette,
  mode: 'light' | 'dark'
): AmbientLightColors {
  const band = AMBIENT_BANDS[mode]

  const converge = (color: AmbientPalette[number]): string => {
    const l = clamp(color.l, band.minLightness, band.maxLightness)
    const c = Math.min(color.c, maxSrgbChroma(l, color.h, band.maxChroma))
    return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${color.h.toFixed(1)})`
  }

  return [converge(palette[0]), converge(palette[1]), converge(palette[2])]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
