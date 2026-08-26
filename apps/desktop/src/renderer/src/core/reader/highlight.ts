/**
 * Highlight tints.
 *
 * A highlight is drawn over the book's own text at reduced opacity, so the
 * palette is fixed here rather than taken from app theme tokens: the same mark
 * must stay legible under every theme and page tint.
 */

import { HIGHLIGHT_COLOR_VALUES, type HighlightColor } from '@shared/db/contracts/enums'

export const HIGHLIGHT_TINTS: Record<HighlightColor, string> = {
  yellow: '#f2c744',
  green: '#5fbf78',
  blue: '#4f9dea',
  pink: '#ea6f9c',
  purple: '#9b7ae0'
}

/** Palette in canonical order, for pickers. */
export const HIGHLIGHT_COLORS: readonly HighlightColor[] = HIGHLIGHT_COLOR_VALUES

/**
 * Outline color of search hits drawn in the text.
 *
 * Search hits are transient rather than saved, so they follow the app accent
 * instead of carrying a color of their own.
 */
export function resolveSearchTint(): string {
  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-primary')
    .trim()
  return accent || '#3b82f6'
}
