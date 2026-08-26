/**
 * Keyboard routing helpers for the reader window.
 *
 * The reading engines bind bare letter keys on the window, so they must yield
 * to whatever text field the reader is typing into.
 */

/** True when a keystroke belongs to a text field rather than to the reader. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true

  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}
