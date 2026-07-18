/**
 * Minimal oklch color math for the ambient light pipeline, per Björn
 * Ottosson's reference transforms. Shared by extraction (sRGB pixels to
 * oklch) and convergence (sRGB gamut ceiling for output chroma).
 */

export interface Oklch {
  l: number
  c: number
  h: number
}

const DEG_PER_RAD = 180 / Math.PI

export function srgbToOklch(r8: number, g8: number, b8: number): Oklch {
  const r = srgbChannelToLinear(r8 / 255)
  const g = srgbChannelToLinear(g8 / 255)
  const b = srgbChannelToLinear(b8 / 255)

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const okLightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const okA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const okB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s

  return {
    l: okLightness,
    c: Math.hypot(okA, okB),
    h: (Math.atan2(okB, okA) * DEG_PER_RAD + 360) % 360
  }
}

/**
 * Largest chroma at the given lightness/hue that stays inside sRGB, capped
 * at `limit`. Bisection is precise enough here: outputs feed low-strength
 * gradient washes, not content colors.
 */
export function maxSrgbChroma(l: number, h: number, limit: number): number {
  if (isOklchInSrgb(l, limit, h)) return limit

  let low = 0
  let high = limit
  for (let i = 0; i < 12; i++) {
    const mid = (low + high) / 2
    if (isOklchInSrgb(l, mid, h)) {
      low = mid
    } else {
      high = mid
    }
  }
  return low
}

function isOklchInSrgb(l: number, c: number, h: number): boolean {
  const hRad = h / DEG_PER_RAD
  const a = c * Math.cos(hRad)
  const b = c * Math.sin(hRad)

  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3

  const r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_
  const g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_
  const bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_

  const epsilon = 1e-4
  return (
    r >= -epsilon &&
    r <= 1 + epsilon &&
    g >= -epsilon &&
    g <= 1 + epsilon &&
    bl >= -epsilon &&
    bl <= 1 + epsilon
  )
}

function srgbChannelToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}
