/**
 * Reading progress thresholds and layout policy shared by the read-session
 * handlers. These are properties of reading rather than of any one media
 * type, so both reading handlers use the same numbers here.
 */

import type { ComicFormat, ComicReadingDirection } from '@shared/db/contracts/enums'

/** Persisting a resume point on every page turn is waste. */
export const RESUME_WRITE_INTERVAL_MS = 5_000

/** Unit numbers are real: keep the decimals a source stated, drop none. */
export function formatUnitNumber(value: number): string {
  return String(value)
}

/** Below this, a session segment is a mis-click rather than reading time. */
export const MIN_READING_SEGMENT_MS = 5_000

/**
 * Fraction of a text volume that counts as read.
 *
 * Books end with colophons and previews, so demanding the final position
 * would leave most finished volumes unread.
 */
export const NOVEL_READ_PROGRESS = 0.98

/**
 * Effective page flow of a comic entry: the per-entry override wins, the
 * format default follows (webtoons scroll vertically, manga pages
 * right-to-left, the rest left-to-right).
 */
export function resolveComicPageFlow(
  readingDirection: ComicReadingDirection | null,
  format: ComicFormat
): ComicReadingDirection {
  if (readingDirection) return readingDirection
  if (format === 'webtoon') return 'vertical'
  if (format === 'manga' || format === 'doujinshi') return 'rtl'
  return 'ltr'
}
