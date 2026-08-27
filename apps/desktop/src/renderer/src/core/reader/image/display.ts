/**
 * Page presentation corrections.
 *
 * Scanned and rasterized pages arrive as they were made — dim, flat, or
 * ringed with scanner margin — so the reader corrects them at display time.
 * Nothing here alters the file.
 */

export interface PageDisplay {
  /** Percentage; 100 leaves the page exactly as scanned. */
  brightness: number
  contrast: number
  /** Trim uniform page margins so the artwork fills the viewport. */
  autoCrop: boolean
}

export const PAGE_DISPLAY_RANGES = {
  brightness: { min: 50, max: 150, step: 5 },
  contrast: { min: 50, max: 200, step: 5 }
} as const

export const DEFAULT_PAGE_DISPLAY: PageDisplay = {
  brightness: 100,
  contrast: 100,
  autoCrop: false
}

/** CSS filter for a page image; `none` while nothing is adjusted. */
export function buildPageFilter(display: PageDisplay): string {
  const parts: string[] = []
  if (display.brightness !== 100) parts.push(`brightness(${display.brightness}%)`)
  if (display.contrast !== 100) parts.push(`contrast(${display.contrast}%)`)
  return parts.length > 0 ? parts.join(' ') : 'none'
}
