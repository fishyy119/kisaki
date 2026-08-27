/**
 * Typed glue over the vendored foliate-js view.
 *
 * The vendored library is untyped ESM; this module is the only place that
 * touches it, exposing exactly the surface the novel engine needs: element
 * creation, opening a volume file (with the TXT adapter), navigation,
 * relocation facts, in-book search, and footnote extraction.
 */

import { buildNovelFileUrl } from '@shared/book'
import type { ReaderUnit } from '@shared/reader'
import { decodeTextFile } from './text-encoding'
import { makeTxtBook } from './txt-book'

export interface FoliateTocItem {
  label: string
  href: string
  subitems?: FoliateTocItem[]
}

export interface FoliateRelocation {
  /** Overall reading fraction in [0, 1]. */
  fraction?: number
  cfi?: string
  tocItem?: { label?: string } | null
  /** Text currently laid out, which a bookmark quotes to identify itself. */
  range?: Range
}

/** Surrounding text of one search hit, already trimmed by the matcher. */
export interface FoliateExcerpt {
  pre: string
  match: string
  post: string
}

/**
 * What `search` yields: a per-section progress tick, a section's hits, or the
 * `'done'` sentinel that ends the run.
 */
export type FoliateSearchResult =
  | 'done'
  | { progress: number }
  | { label: string; subitems: { cfi: string; excerpt: FoliateExcerpt }[] }

/** The book behind the view; footnote resolution needs it alongside the view. */
export interface FoliateBookHandle {
  toc?: FoliateTocItem[]
  dir?: string
  metadata?: { title?: string }
}

export interface FoliateView extends HTMLElement {
  /** Assigned by `open`; a created-but-unopened view has no book yet. */
  book?: FoliateBookHandle
  lastLocation: FoliateRelocation | null
  /** Assigned by `open`; a created-but-unopened view has no renderer yet. */
  renderer?: HTMLElement & {
    setStyles?: (css: string) => void
    next: () => Promise<void>
    prev: () => Promise<void>
  }
  open(book: unknown): Promise<void>
  close(): void
  init(options: { lastLocation?: string; showTextStart?: boolean }): Promise<void>
  goTo(target: string | number): Promise<unknown>
  goToFraction(fraction: number): Promise<unknown>
  goLeft(): Promise<unknown>
  goRight(): Promise<unknown>
  /** Section boundaries in [0, 1], for drawing chapter ticks on a progress track. */
  getSectionFractions(): number[]
  /** Walks the whole book, drawing each hit as it goes. */
  search(options: {
    query: string
    /** Passed to the hit drawing; the vendored default outlines in red. */
    drawOptions?: { color?: string; width?: number }
  }): AsyncGenerator<FoliateSearchResult, void, undefined>
  /** Drops every hit drawn by the last search. */
  clearSearch(): void
  /** Stable position of a range inside one section, as an EPUB CFI. */
  getCFI(index: number, range: Range): string
  /** Drops the reader's selection in every laid-out section. */
  deselect(): void
  /** Asks the view to draw a mark; the drawing itself answers `draw-annotation`. */
  addAnnotation(annotation: FoliateAnnotation): Promise<unknown>
  deleteAnnotation(annotation: FoliateAnnotation): Promise<unknown>
}

/** A mark the view can draw, addressed by the locator it was made at. */
export interface FoliateAnnotation {
  value: string
}

/** Turns the rectangles of a range into the shape drawn over it. */
export type FoliateDraw = (rects: DOMRect[], options: { color?: string }) => Element

/** What `draw-annotation` hands over: which mark, and how to draw it. */
export interface FoliateDrawRequest {
  draw: (drawFunction: FoliateDraw, options: { color?: string }) => void
  annotation: FoliateAnnotation
}

/** Section document the view has just laid out. */
export interface FoliateLoadDetail {
  doc: Document
  index: number
}

/** Which mark the reader clicked in the text. */
export interface FoliateShowAnnotationDetail {
  value: string
}

let highlightDraw: Promise<FoliateDraw> | null = null

/** The vendored highlight drawing, loaded once per window. */
export function loadHighlightDraw(): Promise<FoliateDraw> {
  highlightDraw ??= import('../../../../vendor/foliate-js/overlayer.js').then(
    ({ Overlayer }) => Overlayer.highlight
  )
  return highlightDraw
}

/** Footnote fragment the handler extracted, rendered in its own view element. */
export interface FoliateFootnoteRender {
  view: HTMLElement
  /** Referenced kind (`footnote`, `endnote`, `definition`, …), null when unclear. */
  type: string | null
}

interface FoliateFootnoteHandler extends EventTarget {
  handle(book: FoliateBookHandle, event: Event): Promise<void> | undefined
}

/**
 * Handler that turns a footnote link into a rendered fragment.
 *
 * It is fed the view's cancelable `link` event and cancels the ones it claims,
 * so a footnote reference opens a fragment instead of navigating the book.
 */
export async function createFootnoteHandler(): Promise<FoliateFootnoteHandler> {
  const { FootnoteHandler } = await import('../../../../vendor/foliate-js/footnotes.js')
  return new FootnoteHandler() as FoliateFootnoteHandler
}

/** Resource-load fact the engine publishes before fetching a book resource. */
interface FoliateResourceLoadDetail {
  isScript: boolean
  allow: boolean
}

/** A book whose resource loader can be tapped; only container formats have one. */
interface FoliateBook {
  transformTarget?: EventTarget
}

export async function createFoliateView(): Promise<FoliateView> {
  await import('../../../../vendor/foliate-js/view.js')
  return document.createElement('foliate-view') as FoliateView
}

/**
 * Opens one volume file in the view: TXT through the local adapter, every
 * other container through foliate's own sniffing.
 *
 * The book is built here rather than inside `view.open` so its resource loader
 * can be tapped before any resource is fetched.
 */
export async function openNovelVolume(view: FoliateView, unit: ReaderUnit): Promise<void> {
  if (!unit.fileId) {
    throw new Error('Novel unit has no readable file')
  }

  const response = await fetch(buildNovelFileUrl(unit.fileId))
  if (!response.ok) {
    throw new Error(`Novel file request failed with status ${response.status}`)
  }

  if (unit.container === 'txt') {
    await view.open(makeTxtBook(decodeTextFile(await response.arrayBuffer()), unit.label))
    return
  }

  const { makeBook } = await import('../../../../vendor/foliate-js/view.js')
  const file = new File([await response.blob()], `volume.${unit.container ?? 'epub'}`)
  const book = (await makeBook(file)) as FoliateBook
  rejectScriptResources(book)
  await view.open(book)
}

/**
 * Refuses to load a book's script resources.
 *
 * The reader's CSP and the section iframes' sandbox already keep book scripts
 * from executing; dropping them at the loader means they are never fetched,
 * decoded, or handed a blob URL in the first place.
 */
function rejectScriptResources(book: FoliateBook): void {
  book.transformTarget?.addEventListener('load', (event) => {
    const detail = (event as CustomEvent<FoliateResourceLoadDetail>).detail
    if (detail.isScript) detail.allow = false
  })
}
