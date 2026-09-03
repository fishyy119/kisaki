/**
 * Window geometry policy: fixed pixel minimums, a default size that fits the
 * display, and a pinned page zoom.
 *
 * All windows are frameless or treat their bounds as content bounds, so the
 * shared content-size contract is applied to window sizes directly.
 */

import { screen, type BrowserWindow, type WebContents } from 'electron'
import { MAIN_WINDOW_DEFAULT_CONTENT_SIZE, type WindowContentSize } from '@shared/window'

/** Share of the primary work area the default window may take. */
const DEFAULT_WORK_AREA_SHARE = 0.9

/**
 * Default main-window size: the preferred size, capped by the work area so a
 * first launch lands fully on screen (a 1366×768 laptop at 125% scaling has a
 * ~1092×576 work area), and never below the minimum.
 */
export function resolveDefaultMainWindowSize(minimum: WindowContentSize): WindowContentSize {
  const workArea = screen.getPrimaryDisplay().workAreaSize
  return {
    width: Math.max(
      minimum.width,
      Math.min(
        MAIN_WINDOW_DEFAULT_CONTENT_SIZE.width,
        Math.round(workArea.width * DEFAULT_WORK_AREA_SHARE)
      )
    ),
    height: Math.max(
      minimum.height,
      Math.min(
        MAIN_WINDOW_DEFAULT_CONTENT_SIZE.height,
        Math.round(workArea.height * DEFAULT_WORK_AREA_SHARE)
      )
    )
  }
}

/**
 * Applies the minimum to a window and grows it when it currently sits below
 * (a state restored from before the floor existed).
 */
export function applyMinimumSize(window: BrowserWindow, minimum: WindowContentSize): void {
  window.setMinimumSize(minimum.width, minimum.height)

  // Electron guarantees a [width, height] pair.
  const [width, height] = window.getSize() as [number, number]
  const nextWidth = Math.max(width, minimum.width)
  const nextHeight = Math.max(height, minimum.height)
  if (nextWidth !== width || nextHeight !== height) {
    window.setSize(nextWidth, nextHeight, false)
  }
}

/**
 * Pins page zoom at 100%. Chromium persists per-origin zoom levels across
 * launches, so a zoom that slipped in before the app owned its shortcuts is
 * reset on every load; pinch zoom stays disabled. Text size is the interface
 * scale, never page zoom.
 */
export function lockZoom(webContents: WebContents): void {
  webContents.setVisualZoomLevelLimits(1, 1)
  webContents.on('did-finish-load', () => {
    if (!webContents.isDestroyed()) webContents.setZoomFactor(1)
  })
}
