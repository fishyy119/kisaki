/**
 * Ambient palette extraction from cover images.
 *
 * Samples a small bitmap, buckets chromatic pixels by oklch hue, and returns
 * up to three raw hue anchors ordered by dominance. Output is unconverged:
 * the light controller projects it into the active mode's ambient band at
 * render time. Returns null for unreadable or near-grayscale images so
 * callers fall back to the theme's light tokens.
 */

import { createLogger } from '@renderer/core/log'
import { srgbToOklch, type Oklch } from './oklch'

const log = createLogger('Theme')

/** Raw cover-derived hue anchors, dominant first. */
export type AmbientPalette = readonly [Oklch, Oklch, Oklch]

const SAMPLE_SIZE = 64
const HUE_BIN_COUNT = 24
const HUE_BIN_DEGREES = 360 / HUE_BIN_COUNT
const DEGREES_PER_RADIAN = 180 / Math.PI

/** Pixels below these thresholds carry no usable hue signal. */
const MIN_PIXEL_ALPHA = 128
const MIN_PIXEL_CHROMA = 0.04
const MIN_PIXEL_LIGHTNESS = 0.1
const MAX_PIXEL_LIGHTNESS = 0.97

/** Near-grayscale guard: below this share of chromatic pixels the cover has
 * no honest color story and the theme light applies. */
const MIN_CHROMATIC_PIXEL_RATIO = 0.05

/** A peak (bin merged with its neighbors) must hold at least this share of
 * total chromatic weight to be picked. */
const MIN_PEAK_WEIGHT_RATIO = 0.05
/** Picked hues must be at least this far apart to read as distinct tones. */
const MIN_HUE_DISTANCE = 45
/** Secondary hues stay within this arc of the dominant hue so one lamp
 * never mixes clashing (near-complementary) colors. */
const MAX_HUE_SPREAD = 90
/** Analogous rotation used when the image yields fewer than three hues. */
const FALLBACK_HUE_OFFSET = 40

const CACHE_LIMIT = 64
const cache = new Map<string, AmbientPalette | null>()

interface HueBin {
  weight: number
  lightnessSum: number
  chromaSum: number
  hueXSum: number
  hueYSum: number
}

interface Histogram {
  bins: HueBin[]
  opaquePixels: number
  chromaticPixels: number
}

export async function extractAmbientPalette(url: string): Promise<AmbientPalette | null> {
  const cached = cache.get(url)
  if (cached !== undefined) {
    // LRU touch: re-insert so hot covers survive eviction.
    cache.delete(url)
    cache.set(url, cached)
    return cached
  }

  let palette: AmbientPalette | null
  try {
    palette = await extract(url)
  } catch (error) {
    // Fall back to theme tokens; logged once per URL (result is cached).
    log.warn('Ambient palette extraction failed.', error)
    palette = null
  }

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(url, palette)
  return palette
}

async function extract(url: string): Promise<AmbientPalette | null> {
  // CORS-mode load: the attachment protocol opts into CORS, so the decoded
  // pixels stay readable through getImageData without depending on the
  // window's webSecurity setting.
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.decoding = 'async'
  image.src = url
  await image.decode()

  const bitmap = await createImageBitmap(image, {
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
  return pickPalette(collectHistogram(data))
}

function collectHistogram(data: Uint8ClampedArray): Histogram {
  const bins: HueBin[] = Array.from({ length: HUE_BIN_COUNT }, () => ({
    weight: 0,
    lightnessSum: 0,
    chromaSum: 0,
    hueXSum: 0,
    hueYSum: 0
  }))

  let opaquePixels = 0
  let chromaticPixels = 0

  for (let i = 0; i + 3 < data.length; i += 4) {
    const alpha = data[i + 3] ?? 0
    if (alpha < MIN_PIXEL_ALPHA) continue
    opaquePixels++

    const { l, c, h } = srgbToOklch(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0)
    if (c < MIN_PIXEL_CHROMA || l < MIN_PIXEL_LIGHTNESS || l > MAX_PIXEL_LIGHTNESS) continue
    chromaticPixels++

    const bin = bins[Math.min(Math.floor(h / HUE_BIN_DEGREES), HUE_BIN_COUNT - 1)]
    if (!bin) continue

    // Chroma-weighted sums: saturated pixels define the ambient tone. Hue
    // accumulates as a unit vector so circular means never wrap-around.
    const hueRadians = h / DEGREES_PER_RADIAN
    bin.weight += c
    bin.lightnessSum += l * c
    bin.chromaSum += c * c
    bin.hueXSum += Math.cos(hueRadians) * c
    bin.hueYSum += Math.sin(hueRadians) * c
  }

  return { bins, opaquePixels, chromaticPixels }
}

function pickPalette({ bins, opaquePixels, chromaticPixels }: Histogram): AmbientPalette | null {
  if (opaquePixels === 0 || chromaticPixels / opaquePixels < MIN_CHROMATIC_PIXEL_RATIO) return null

  const totalWeight = bins.reduce((sum, bin) => sum + bin.weight, 0)
  if (totalWeight <= 0) return null

  // Smooth across neighbors so a hue mass straddling a bin edge still ranks
  // as one peak; near-duplicate peaks are dropped by the distance rule.
  const peaks = bins.map((_, index) => mergeWithNeighbors(bins, index))

  const picked: Oklch[] = []
  for (const peak of [...peaks].sort((a, b) => b.weight - a.weight)) {
    if (picked.length === 3) break
    if (peak.weight < totalWeight * MIN_PEAK_WEIGHT_RATIO) break

    const color = binToOklch(peak)
    const primary = picked[0]
    if (primary && circularHueDistance(primary.h, color.h) > MAX_HUE_SPREAD) continue
    if (picked.some((chosen) => circularHueDistance(chosen.h, color.h) < MIN_HUE_DISTANCE)) continue
    picked.push(color)
  }

  const primary = picked[0]
  if (!primary) return null

  // Analogous bracket fill: missing tones rotate off the dominant hue,
  // mirroring the side an extracted secondary already occupies.
  const secondary = picked[1] ?? { ...primary, h: rotateHue(primary.h, FALLBACK_HUE_OFFSET) }
  const oppositeSide = signedHueDelta(secondary.h, primary.h) >= 0 ? -1 : 1
  const tertiary = picked[2] ?? {
    ...primary,
    h: rotateHue(primary.h, oppositeSide * FALLBACK_HUE_OFFSET)
  }

  return [primary, secondary, tertiary]
}

function mergeWithNeighbors(bins: HueBin[], index: number): HueBin {
  const merged: HueBin = { weight: 0, lightnessSum: 0, chromaSum: 0, hueXSum: 0, hueYSum: 0 }
  for (const offset of [-1, 0, 1]) {
    const bin = bins[(index + offset + bins.length) % bins.length]
    if (!bin) continue
    merged.weight += bin.weight
    merged.lightnessSum += bin.lightnessSum
    merged.chromaSum += bin.chromaSum
    merged.hueXSum += bin.hueXSum
    merged.hueYSum += bin.hueYSum
  }
  return merged
}

function binToOklch(bin: HueBin): Oklch {
  return {
    l: bin.lightnessSum / bin.weight,
    c: bin.chromaSum / bin.weight,
    h: (Math.atan2(bin.hueYSum, bin.hueXSum) * DEGREES_PER_RADIAN + 360) % 360
  }
}

function circularHueDistance(a: number, b: number): number {
  const distance = Math.abs(a - b) % 360
  return Math.min(distance, 360 - distance)
}

/** Shortest signed arc from `origin` to `target`, in (-180, 180]. */
function signedHueDelta(target: number, origin: number): number {
  return ((target - origin + 540) % 360) - 180
}

function rotateHue(hue: number, delta: number): number {
  return (hue + delta + 360) % 360
}
