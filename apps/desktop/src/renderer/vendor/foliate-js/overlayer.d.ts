/**
 * Minimal local declarations for the vendored, untyped foliate-js overlayer.
 * Only the draw functions the reader hands back to the view are declared; the
 * renderer's typed surface lives in `@renderer/reader/foliate`.
 */
export class Overlayer {
  static highlight(rects: DOMRect[], options?: { color?: string }): Element
}
