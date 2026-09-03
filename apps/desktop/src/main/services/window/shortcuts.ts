import type { BrowserWindow } from 'electron'
import { isDev } from '@main/env'
import { MAIN_WINDOW_MIN_CONTENT_SIZE, type WindowContentSize } from '@shared/window'

/**
 * Interface scale chords, owned by the app in every window: Ctrl+= / Ctrl++ and
 * Ctrl+- step through the scale presets, Ctrl+0 returns to the default. They
 * replace the browser zoom accelerators the removed application menu used to
 * expose, so the muscle memory lands on a persisted, floor-aware setting
 * instead of an unowned page zoom. Matched on key codes (layout independent,
 * numpad included) with the key value as fallback for synthesized input,
 * which carries no code.
 */
export function watchInterfaceScaleShortcuts(
  window: BrowserWindow,
  onStep: (direction: 1 | -1 | 0) => void
): void {
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !input.control || input.alt || input.meta) return

    const direction = resolveScaleDirection(input.code, input.key)
    if (direction === null) return

    event.preventDefault()
    onStep(direction)
  })
}

function resolveScaleDirection(code: string, key: string): 1 | -1 | 0 | null {
  switch (code || key) {
    case 'Equal':
    case 'NumpadAdd':
    case '=':
    case '+':
      return 1
    case 'Minus':
    case 'NumpadSubtract':
    case '-':
      return -1
    case 'Digit0':
    case 'Numpad0':
    case '0':
      return 0
    default:
      return null
  }
}

/**
 * Development keyboard policy for every window: F12 toggles DevTools.
 * Production has no other window shortcuts: with no application menu there
 * are no accelerators to suppress.
 */
export function watchWindowShortcuts(window: BrowserWindow): void {
  if (!isDev) return

  const { webContents } = window
  webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown' || input.code !== 'F12') return

    if (webContents.isDevToolsOpened()) {
      webContents.closeDevTools()
    } else {
      webContents.openDevTools({ mode: 'undocked' })
    }
  })
}

/**
 * Viewport probe stops, in CSS pixels: the design floor, the 1366×768 @125%
 * laptop work area, and the comfortable tier. Fixed pixels on purpose - at a
 * larger interface scale the same window is a narrower rem viewport, which is
 * exactly the usable-tier case the probe should reach.
 */
const VIEWPORT_PROBE_STOPS: readonly WindowContentSize[] = [
  MAIN_WINDOW_MIN_CONTENT_SIZE,
  { width: 1092, height: 576 },
  { width: 1280, height: 720 }
]

/**
 * Development-only main window probe: Ctrl+Shift+M cycles the window through
 * the viewport stops and then restores the size it started from, so every
 * surface can be checked at the sizes the UI contract promises. Ctrl+Shift
 * avoids the AltGr collisions Ctrl+Alt chords have on many Windows keyboard
 * layouts.
 */
export function watchViewportProbe(window: BrowserWindow): void {
  if (!isDev) return

  let probeIndex = -1
  let sizeBeforeProbe: [number, number] | null = null

  function cycle(): void {
    if (window.isMaximized()) window.unmaximize()

    probeIndex += 1
    if (probeIndex >= VIEWPORT_PROBE_STOPS.length) {
      probeIndex = -1
      if (sizeBeforeProbe) window.setSize(...sizeBeforeProbe, false)
      sizeBeforeProbe = null
      return
    }

    if (probeIndex === 0) sizeBeforeProbe = window.getSize() as [number, number]

    const stop = VIEWPORT_PROBE_STOPS[probeIndex]!
    window.setSize(stop.width, stop.height, false)
  }

  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    // Matched on `key`: synthesized input (automation) carries no key code.
    if (input.key.toLowerCase() !== 'm' || !input.control || !input.shift || input.alt) return
    if (input.meta) return

    event.preventDefault()
    cycle()
  })
}
