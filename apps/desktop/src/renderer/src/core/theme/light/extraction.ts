/**
 * Ambient color extraction from cover images.
 *
 * Samples a small bitmap, buckets chromatic pixels by oklch hue, and returns
 * three CSS oklch colors converged into an ambient-friendly lightness/chroma
 * range. Returns null for unreadable or (near-)grayscale images so callers
 * fall back to the theme's light tokens.
 */

import { createLogger } from '@renderer/core/log'
import type { AmbientLightColors } from './controller'

const log = createLogger('Theme')

const SAMPLE_SIZE = 64
const HUE_BIN_COUNT = 24
const HUE_BIN_DEGREES = 360 / HUE_BIN_COUNT

/** Pixels below these thresholds carry no usable hue signal. */
const MIN_PIXEL_ALPHA = 128
const MIN_PIXEL_CHROMA = 0.04
const MIN_PIXEL_LIGHTNESS = 0.1
const MAX_PIXEL_LIGHTNESS = 0.97

/** A hue bin must hold at least this share of total weight to be picked. */
const MIN_BIN_WEIGHT_RATIO = 0.04
/** Picked hues must be at least this far apart to read as distinct tones. */
const MIN_HUE_DISTANCE = 45
/** Analogous rotation used when the image yields fewer than three hues. */
const FALLBACK_HUE_OFFSET = 40

/** Ambient convergence range: mid lightness, soft-but-visible chroma. */
const AMBIENT_MIN_LIGHTNESS = 0.55
const AMBIENT_MAX_LIGHTNESS = 0.78
const AMBIENT_MIN_CHROMA = 0.08
const AMBIENT_MAX_CHROMA = 0.17

const CACHE_LIMIT = 64
const cache = new Map<string, AmbientLightColors | null>()

interface Oklch {
  l: number
  c: number
  h: number
}

interface HueBin {
  weight: number
  lightnessSum: number
  chromaSum: number
  hueSum: number
}

export async function extractAmbientLightColors(url: string): Promise<AmbientLightColors | null> {
  const cached = cache.get(url)
  if (cached !== undefined) return cached

  let colors: AmbientLightColors | null
  try {
    colors = await extract(url)
  } catch (error) {
    // Fall back to theme tokens; logged once per URL (result is cached).
    log.warn('Ambient color extraction failed.', error)
    colors = null
  }

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(url, colors)
  return colors
}

async function extract(url: string): Promise<AmbientLightColors | null> {
  const response = await fetch(url)
  if (!response.ok) return null

  const bitmap = await createImageBitmap(await response.blob(), {
    resizeWidth: SAMPLE_SIZE,
    resizeHeight: SAMPLE_SIZE,
    resizeQuality: 'low'
  })

  const canvas = new OffscreenCanvas(SAMPLE_SIZE, SAMPLE_SIZE)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    bitmap.close()
    return null
  }

  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  const { data } = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
  return pickAmbientColors(collectHueBins(data))
}

function collectHueBins(data: Uint8ClampedArray): HueBin[] {
  const bins: HueBin[] = Array.from({ length: HUE_BIN_COUNT }, () => ({
    weight: 0,
    lightnessSum: 0,
    chromaSum: 0,
    hueSum: 0
  }))

  for (let i = 0; i + 3 < data.length; i += 4) {
    const alpha = data[i + 3] ?? 0
    if (alpha < MIN_PIXEL_ALPHA) continue

    const { l, c, h } = srgbToOklch(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0)
    if (c < MIN_PIXEL_CHROMA || l < MIN_PIXEL_LIGHTNESS || l > MAX_PIXEL_LIGHTNESS) continue

    const bin = bins[Math.min(Math.floor(h / HUE_BIN_DEGREES), HUE_BIN_COUNT - 1)]
    if (!bin) continue

    // Chroma-weighted sums: saturated pixels define the ambient tone.
    bin.weight += c
    bin.lightnessSum += l * c
    bin.chromaSum += c * c
    bin.hueSum += h * c
  }

  return bins
}

function pickAmbientColors(bins: HueBin[]): AmbientLightColors | null {
  const totalWeight = bins.reduce((sum, bin) => sum + bin.weight, 0)
  if (totalWeight <= 0) return null

  const picked: Oklch[] = []
  for (const bin of [...bins].sort((a, b) => b.weight - a.weight)) {
    if (picked.length === 3) break
    if (bin.weight < totalWeight * MIN_BIN_WEIGHT_RATIO) break

    const hue = bin.hueSum / bin.weight
    if (picked.some((color) => circularHueDistance(color.h, hue) < MIN_HUE_DISTANCE)) continue

    picked.push({
      l: bin.lightnessSum / bin.weight,
      c: bin.chromaSum / bin.weight,
      h: hue
    })
  }

  const primary = picked[0]
  if (!primary) return null

  while (picked.length < 3) {
    picked.push({ ...primary, h: (primary.h + FALLBACK_HUE_OFFSET * picked.length) % 360 })
  }

  return [toAmbientCss(picked[0]), toAmbientCss(picked[1]), toAmbientCss(picked[2])]
}

function toAmbientCss(color: Oklch | undefined): string {
  if (!color) return 'transparent'

  const l = clamp(color.l, AMBIENT_MIN_LIGHTNESS, AMBIENT_MAX_LIGHTNESS)
  const c = clamp(color.c, AMBIENT_MIN_CHROMA, AMBIENT_MAX_CHROMA)
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${color.h.toFixed(1)})`
}

function circularHueDistance(a: number, b: number): number {
  const distance = Math.abs(a - b) % 360
  return Math.min(distance, 360 - distance)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** sRGB (0-255 channels) to oklch, per Björn Ottosson's reference transform. */
function srgbToOklch(r8: number, g8: number, b8: number): Oklch {
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
    h: (Math.atan2(okB, okA) * (180 / Math.PI) + 360) % 360
  }
}

function srgbChannelToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}
