/**
 * Modal region contract.
 *
 * Every document that hosts app dialogs declares one `#modal-layer` element:
 * the region modals are confined to and centered in. The main window declares
 * it over the area below the titlebar (so window chrome is never covered and
 * stays draggable while a modal is open); the reader window, which has a native
 * frame, declares it over the whole document. Dialog and alert-dialog content
 * portal into it; the layer itself takes no pointer events so it is inert
 * while empty.
 */
export const MODAL_LAYER_ID = 'modal-layer'

export const MODAL_LAYER_SELECTOR = `#${MODAL_LAYER_ID}`

/** Classes of the layer element: fills its positioned host, above in-page overlays. */
export const MODAL_LAYER_CLASS = 'absolute inset-0 z-40 pointer-events-none'
