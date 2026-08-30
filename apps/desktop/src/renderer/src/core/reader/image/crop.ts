/**
 * Automatic page trimming for scanned comics.
 *
 * A scan usually carries a uniform border the artwork does not need. The trim
 * box is found on a downscaled copy of the page: the corners say what the
 * border looks like, and each edge is walked inwards while the lines still look
 * like border. Results are remembered per page URL, because a page is trimmed
 * every time it comes back on screen but its pixels never change.
 */

import { createLogger } from '@renderer/core/log'

const log = createLogger('Reader')

/** Sampling width; borders are large features and survive heavy downscaling. */
const SAMPLE_WIDTH = 160

/** Per-channel distance from the border color still counted as border. */
const COLOR_TOLERANCE = 24

/** Share of a line that must look like border for the line to be border. */
const LINE_BORDER_RATIO = 0.995

/** Below this, a detected border is not worth the reflow. */
const MIN_TRIM_FRACTION = 0.01

/** A trim this deep means the page was misread, not generously margined. */
const MAX_TRIM_FRACTION = 0.25

/** Trim boxes held before the oldest are forgotten. */
const CACHE_MAX_ENTRIES = 512

/** Region of a page worth showing, as fractions inset from each edge. */
export interface CropInsets {
  top: number
  right: number
  bottom: number
  left: number
}

const cache = new Map<string, CropInsets | null>()

/**
 * Trim box of one page, or null when the page needs no trimming.
 *
 * A page that cannot be measured — still loading, cross-origin, decode failure
 * — also answers null, so display falls back to the untrimmed page rather than
 * failing.
 */
export async function detectCropInsets(url: string): Promise<CropInsets | null> {
  const cached = cache.get(url)
  if (cached !== undefined) return cached

  let insets: CropInsets | null = null
  try {
    insets = measure(await loadImage(url))
  } catch (error) {
    log.warn('Failed to measure a page for trimming.', error)
  }

  remember(url, insets)
  return insets
}

function remember(url: string, insets: CropInsets | null): void {
  cache.set(url, insets)
  while (cache.size > CACHE_MAX_ENTRIES) {
    cache.delete(cache.keys().next().value as string)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    // Book pages are served with permissive CORS headers so the canvas they are
    // drawn onto stays readable.
    image.crossOrigin = 'anonymous'
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error('Page image failed to load')))
    image.src = url
  })
}

function measure(image: HTMLImageElement): CropInsets | null {
  const width = image.naturalWidth
  const height = image.naturalHeight
  if (width === 0 || height === 0) return null

  const scale = Math.min(1, SAMPLE_WIDTH / width)
  const sampleWidth = Math.max(1, Math.round(width * scale))
  const sampleHeight = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = sampleWidth
  canvas.height = sampleHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  context.drawImage(image, 0, 0, sampleWidth, sampleHeight)
  const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight)

  const border = readBorderColor(data, sampleWidth, sampleHeight)
  const isBorder = (x: number, y: number): boolean => {
    const offset = (y * sampleWidth + x) * 4
    return (
      Math.abs(data[offset]! - border[0]) <= COLOR_TOLERANCE &&
      Math.abs(data[offset + 1]! - border[1]) <= COLOR_TOLERANCE &&
      Math.abs(data[offset + 2]! - border[2]) <= COLOR_TOLERANCE
    )
  }

  const rowIsBorder = (y: number): boolean => {
    let matches = 0
    for (let x = 0; x < sampleWidth; x += 1) if (isBorder(x, y)) matches += 1
    return matches / sampleWidth >= LINE_BORDER_RATIO
  }

  const columnIsBorder = (x: number): boolean => {
    let matches = 0
    for (let y = 0; y < sampleHeight; y += 1) if (isBorder(x, y)) matches += 1
    return matches / sampleHeight >= LINE_BORDER_RATIO
  }

  let top = 0
  while (top < sampleHeight - 1 && rowIsBorder(top)) top += 1
  let bottom = 0
  while (bottom < sampleHeight - 1 - top && rowIsBorder(sampleHeight - 1 - bottom)) bottom += 1
  let left = 0
  while (left < sampleWidth - 1 && columnIsBorder(left)) left += 1
  let right = 0
  while (right < sampleWidth - 1 - left && columnIsBorder(sampleWidth - 1 - right)) right += 1

  const insets: CropInsets = {
    top: top / sampleHeight,
    bottom: bottom / sampleHeight,
    left: left / sampleWidth,
    right: right / sampleWidth
  }

  return isWorthTrimming(insets) ? insets : null
}

/** Border color, taken as the median of the four corners. */
function readBorderColor(
  data: Uint8ClampedArray,
  width: number,
  height: number
): [number, number, number] {
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + width - 1) * 4
  ]

  const channel = (offset: number): number => {
    const values = corners.map((corner) => data[corner + offset]!).sort((a, b) => a - b)
    return Math.round((values[1]! + values[2]!) / 2)
  }

  return [channel(0), channel(1), channel(2)]
}

function isWorthTrimming(insets: CropInsets): boolean {
  const values = [insets.top, insets.right, insets.bottom, insets.left]
  return (
    values.some((value) => value >= MIN_TRIM_FRACTION) &&
    values.every((value) => value <= MAX_TRIM_FRACTION)
  )
}

/** CSS `object-view-box` value for a trim box. */
export function formatViewBox(insets: CropInsets): string {
  const percent = (value: number): string => `${(value * 100).toFixed(2)}%`
  return `inset(${percent(insets.top)} ${percent(insets.right)} ${percent(insets.bottom)} ${percent(insets.left)})`
}
