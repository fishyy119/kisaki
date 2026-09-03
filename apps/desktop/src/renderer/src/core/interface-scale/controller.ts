/**
 * Renderer interface-scale controller.
 *
 * Mirrors the interface scale owned by the main window service: fetches it
 * during bootstrap, follows cross-window change pushes, and turns it into the
 * root font size. The rem scale is the only thing that moves — every layout
 * dimension is expressed in rem, so one property change rescales the whole
 * document. Window minimums do not follow the scale; a large scale in a small
 * window simply lays the surfaces out at their narrower tiers.
 *
 * The main process is the single writer (settings surface through
 * `setInterfaceScale`, keyboard chords in every window) and pushes the new
 * value back to every window, so all documents rescale through this one path.
 */

import { computed, shallowRef, type ComputedRef, type ShallowRef } from 'vue'
import { BASE_TEXT_SIZE_PX, UI_SCALE_DEFAULT, uiScaleTextSize, type UiScale } from '@shared/window'
import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Scale')

const scaleRef = shallowRef<UiScale>(UI_SCALE_DEFAULT)

/** Interface scale in effect (reactive, read-only). */
export const uiScale: Readonly<ShallowRef<UiScale>> = scaleRef

/** Root font size in CSS pixels at the current scale (reactive). */
export const rootFontSizePx: ComputedRef<number> = computed(
  () => (BASE_TEXT_SIZE_PX * scaleRef.value) / 100
)

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

  ipcManager.on('window:interface-scale-changed', (_e, scale) => {
    applyScale(scale)
    log.info('Interface scale changed.', { scale })
  })
}

/** Ask the main process to persist a new interface scale; the push applies it. */
export async function setInterfaceScale(scale: UiScale): Promise<void> {
  unwrapIpcVoid(await ipcManager.invoke('window:set-interface-scale', scale))
}

function applyScale(scale: UiScale): void {
  scaleRef.value = scale
  document.documentElement.style.setProperty('--text-base-size', uiScaleTextSize(scale))
}
