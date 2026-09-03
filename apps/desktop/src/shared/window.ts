/**
 * Window geometry contract shared by the main process (window limits) and the
 * renderer (root font size).
 *
 * The interface scale is the single lever of the rem scale: the renderer sets
 * `--text-base-size = BASE_TEXT_SIZE_PX × scale`. Window minimums are fixed
 * CSS pixels and do not follow the scale: a larger scale on a small display
 * simply shows less - the layout degrades through its fluid rules (the
 * "usable" tier) instead of the window refusing to fit the screen.
 */

export interface WindowContentSize {
  width: number
  height: number
}

/**
 * Smallest main-window content box, in CSS pixels. At 100% scale this is the
 * "correct" design tier (68rem × 40rem); at 130% the same box is the "usable"
 * tier (about 52rem × 30rem). Fits the 1366×768 @125% laptop work area
 * (about 1092×576) and 1280×720 @100%.
 */
export const MAIN_WINDOW_MIN_CONTENT_SIZE: WindowContentSize = { width: 960, height: 560 }

/** Largest default main-window content box; the work area caps it below this. */
export const MAIN_WINDOW_DEFAULT_CONTENT_SIZE: WindowContentSize = { width: 1400, height: 850 }

/** Reader windows show one document and tolerate a much smaller box. */
export const READER_WINDOW_MIN_CONTENT_SIZE: WindowContentSize = { width: 480, height: 360 }

/** Root font size in CSS pixels at 100% interface scale. */
export const BASE_TEXT_SIZE_PX = 14

/**
 * Interface scale steps, in percent: even 10% steps, communicable and
 * keyboard-steppable. The range is a density preference around the design
 * size (±30%, 70% on the dense end); accessibility magnification belongs to
 * the operating system's display scaling, which the app inherits.
 */
export const UI_SCALE_VALUES = [70, 80, 90, 100, 110, 120, 130] as const

export type UiScale = (typeof UI_SCALE_VALUES)[number]

export const UI_SCALE_DEFAULT: UiScale = 100

/** Total-parse read of a stored or transported scale; unknown values fall back to the default. */
export function parseUiScale(value: unknown): UiScale {
  return UI_SCALE_VALUES.find((scale) => scale === value) ?? UI_SCALE_DEFAULT
}

/** The neighbouring step in the given direction; the ends hold. */
export function stepUiScale(scale: UiScale, direction: 1 | -1): UiScale {
  const index = UI_SCALE_VALUES.indexOf(scale)
  return UI_SCALE_VALUES[Math.min(UI_SCALE_VALUES.length - 1, Math.max(0, index + direction))]!
}

/** Root font size for a scale, as a CSS length. */
export function uiScaleTextSize(scale: UiScale): string {
  return `${(BASE_TEXT_SIZE_PX * scale) / 100}px`
}
