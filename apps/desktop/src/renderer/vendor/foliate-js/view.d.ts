/**
 * Minimal local declarations for the vendored, untyped foliate-js view
 * module. The renderer's typed surface lives in `@renderer/reader/foliate`;
 * this file only keeps the side-effect import type-checkable.
 */
export class View extends HTMLElement {}
export const makeBook: (file: unknown) => Promise<object>
