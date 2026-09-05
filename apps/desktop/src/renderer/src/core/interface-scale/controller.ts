/**
 * Renderer interface-scale controller.
 *
 * Mirrors the interface scale owned by the main window service: fetches it
 * during bootstrap and follows cross-window change pushes. CSS combines the
 * multiplier with its base typography to set the root font size. Every layout
 * dimension is expressed in rem, so one property change rescales the whole
 * document. Window minimums do not follow the scale; a large scale in a small
 * window simply lays the surfaces out at their narrower tiers.
 *
 * The main process is the single writer (settings surface through
 * `setInterfaceScale`, keyboard chords in every window) and pushes the new
 * value back to every window, so all documents rescale through this one path.
 */

import { shallowRef, type ShallowRef } from 'vue'
import { UI_SCALE_DEFAULT, type UiScale } from '@shared/window'
import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Scale')

const scaleRef = shallowRef<UiScale>(UI_SCALE_DEFAULT)
const rootFontSizeRef = shallowRef(readRootFontSizePx())

/** Interface scale in effect (reactive, read-only). */
export const uiScale: Readonly<ShallowRef<UiScale>> = scaleRef

/** Resolved root font size in CSS pixels, including typography and scale changes. */
export const rootFontSizePx: Readonly<ShallowRef<number>> = rootFontSizeRef

/**
 * A rem length in CSS pixels at the current scale, for layout code that must
 * speak pixels (virtualizer estimates, canvases). Read inside a computed so
 * the estimate follows the scale.
 */
export function remToPx(rem: number): number {
  return rem * rootFontSizePx.value
}

/**
 * Fetch the interface scale from the main process and subscribe to changes.
 * Must complete before the app mounts so the first paint is at the right scale.
 */
export async function initInterfaceScale(): Promise<void> {
  applyScale(unwrapIpcData(await ipcManager.invoke('window:get-interface-scale')))

  const stopObserving = observeRootFontSize()
  const unsubscribe = ipcManager.on('window:interface-scale-changed', (_e, scale) => {
    applyScale(scale)
    log.info('Interface scale changed.', { scale })
  })

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      unsubscribe()
      stopObserving()
    })
  }
}

/** Ask the main process to persist a new interface scale; the push applies it. */
export async function setInterfaceScale(scale: UiScale): Promise<void> {
  unwrapIpcVoid(await ipcManager.invoke('window:set-interface-scale', scale))
}

function applyScale(scale: UiScale): void {
  document.documentElement.style.setProperty('--interface-scale', String(scale / 100))
  rootFontSizeRef.value = readRootFontSizePx()
  scaleRef.value = scale
}

function readRootFontSizePx(): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
}

/** Track CSS changes too: the viewport-sized root itself does not resize when rem changes. */
function observeRootFontSize(): () => void {
  const probe = document.createElement('span')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText =
    'position: fixed; top: 0; left: 0; width: 1rem; height: 0; visibility: hidden; pointer-events: none;'
  document.body.appendChild(probe)

  const observer = new ResizeObserver(() => {
    rootFontSizeRef.value = readRootFontSizePx()
  })
  observer.observe(probe)

  return () => {
    observer.disconnect()
    probe.remove()
  }
}
