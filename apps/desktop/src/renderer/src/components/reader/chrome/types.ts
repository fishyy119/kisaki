/**
 * Presentation shapes of the reader chrome.
 *
 * Comic chapters and novel volumes reach the toolbar, navigation panel, and
 * progress footer through these shapes, so the chrome never branches on which
 * engine is reading behind it.
 */

/** One selectable reading unit: a comic chapter or a novel volume. */
export interface ReaderNavUnit {
  id: string
  label: string
  read: boolean
  /** A catalogued unit with no file is listed but cannot be opened. */
  readable: boolean
}

/**
 * Reading position the progress footer renders and seeks over. Paged units
 * address whole pages; reflowable text has no page grid and moves by fraction.
 */
export type ReaderProgress =
  | {
      kind: 'page'
      pageIndex: number
      /** Null while a container never revealed its page count. */
      pageCount: number | null
      /** Right-to-left comics run their slider the other way around. */
      rtl: boolean
    }
  | {
      kind: 'fraction'
      fraction: number
      /** Section boundaries in [0, 1], drawn as chapter ticks. */
      sectionFractions: number[]
      /** Current section name; empty when the book has no usable TOC. */
      section: string
    }
