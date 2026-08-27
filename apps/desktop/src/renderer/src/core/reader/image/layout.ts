/**
 * Layout model of the image reading engine.
 *
 * A slot is what one screen shows: a single page, or the two facing pages of
 * a spread. Print comics open on a standalone cover, and a page wider than it
 * is tall is artwork drawn across both pages, so slotting is driven by the
 * cover choice and the measured wide pages; slots are addressed by page
 * index, so reslotting as measurements arrive never loses the reader's page.
 *
 * Geometry turns measured page sizes into on-screen pixel sizes: the fit mode
 * sets the base scale against the viewport, zoom multiplies it. Facing pages
 * are normalized to one shared height before scaling, the way they were
 * printed.
 */

/** How the base scale is chosen against the viewport. */
export type PageFitMode = 'page' | 'width' | 'height'

/** Pages one screen shows: singles, facing pairs, or pairs after a lone cover. */
export type PageLayoutMode = 'single' | 'double' | 'double-cover'

export const PAGE_FIT_MODES = ['page', 'width', 'height'] as const satisfies readonly PageFitMode[]

export const PAGE_LAYOUT_MODES = [
  'single',
  'double',
  'double-cover'
] as const satisfies readonly PageLayoutMode[]

/** Zoom multiplies the fit base, so 1 always means "exactly as fitted". */
export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 4
export const ZOOM_STEP = 0.25

export interface PageDims {
  width: number
  height: number
}

/** Zero-based page indexes shown together, in reading order. */
export type PageSlot = readonly number[]

/** A page wider than tall is a spread scanned as one image; it stands alone. */
export function isWidePage(dims: PageDims): boolean {
  return dims.width > dims.height
}

export function buildPageSlots(
  pageCount: number,
  layout: PageLayoutMode,
  widePages: ReadonlySet<number>
): PageSlot[] {
  if (pageCount <= 0) return []
  if (layout === 'single') {
    return Array.from({ length: pageCount }, (_, index) => [index])
  }

  const slots: PageSlot[] = []
  let index = 0

  // A wide cover already stands alone, so the offset only applies to a narrow one.
  if (layout === 'double-cover' && !widePages.has(0)) {
    slots.push([0])
    index = 1
  }

  while (index < pageCount) {
    if (widePages.has(index)) {
      slots.push([index])
      index += 1
      continue
    }

    const partner = index + 1
    if (partner < pageCount && !widePages.has(partner)) {
      slots.push([index, partner])
      index += 2
    } else {
      slots.push([index])
      index += 1
    }
  }

  return slots
}

/** Slot showing a page, or 0 when the page is out of range. */
export function findSlotIndex(slots: readonly PageSlot[], pageIndex: number): number {
  const found = slots.findIndex((slot) => slot.includes(pageIndex))
  return found === -1 ? 0 : found
}

export function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(value.toFixed(2))))
}

/**
 * Pixel sizes of one slot's pages inside a viewport.
 *
 * Pages are first normalized to a shared height, preserving each aspect
 * ratio; the fit mode then scales that composed row against the viewport and
 * zoom multiplies the result. Sizes come back in slot order.
 */
export function computeSlotLayout(
  viewport: PageDims,
  pages: readonly PageDims[],
  fit: PageFitMode,
  zoom: number
): PageDims[] {
  if (pages.length === 0) return []

  const rowHeight = Math.max(...pages.map((page) => page.height))
  const widths = pages.map((page) => (page.height > 0 ? (page.width / page.height) * rowHeight : 0))
  const rowWidth = widths.reduce((sum, width) => sum + width, 0)
  if (rowWidth <= 0 || rowHeight <= 0) return pages.map(() => ({ width: 0, height: 0 }))

  const widthScale = viewport.width / rowWidth
  const heightScale = viewport.height / rowHeight
  const base =
    fit === 'width'
      ? widthScale
      : fit === 'height'
        ? heightScale
        : Math.min(widthScale, heightScale)

  const scale = Math.max(0, base) * zoom
  return widths.map((width) => ({
    width: Math.round(width * scale),
    height: Math.round(rowHeight * scale)
  }))
}
