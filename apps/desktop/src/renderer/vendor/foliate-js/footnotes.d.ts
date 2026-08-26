/**
 * Minimal local declarations for the vendored, untyped foliate-js footnote
 * handler. The renderer's typed surface lives in `@renderer/reader/foliate`;
 * this file only keeps the dynamic import type-checkable.
 */
export class FootnoteHandler extends EventTarget {
  detectFootnotes: boolean
  handle(book: unknown, event: Event): Promise<void> | undefined
}
