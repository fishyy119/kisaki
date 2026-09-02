/**
 * Playback progress thresholds shared by the watch-session handlers.
 *
 * These are properties of video playback rather than of any one media type, so
 * every watch session reads the same numbers here.
 */

/**
 * Fraction of a title that counts as watched.
 *
 * Releases carry endings and previews after the story ends, so demanding the
 * final seconds would leave most finished playbacks unwatched.
 */
export const WATCHED_POSITION_RATIO = 0.9

/** Below this, a stop is a mis-click rather than a resume point worth keeping. */
export const MIN_RESUME_POSITION_MS = 30_000

/** Progress is reported every second; persisting a resume point that often is waste. */
export const RESUME_WRITE_INTERVAL_MS = 15_000

/** Whether a stop position is far enough in to count the title as watched. */
export function isWatchedPosition(positionMs: number, durationMs: number | null): boolean {
  return durationMs !== null && durationMs > 0 && positionMs >= durationMs * WATCHED_POSITION_RATIO
}

/** The resume point to store for a stop position, or null if it is not worth one. */
export function toResumePosition(positionMs: number): number | null {
  return positionMs >= MIN_RESUME_POSITION_MS ? Math.floor(positionMs) : null
}
