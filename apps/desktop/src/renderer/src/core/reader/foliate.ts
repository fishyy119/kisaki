/**
 * Typed glue over the vendored foliate-js view.
 *
 * The vendored library is untyped ESM; this module is the only place that
 * touches it, exposing exactly the surface the novel engine needs: element
 * creation, opening a volume file (with the TXT adapter), navigation, and
 * relocation facts.
 */

import { buildNovelFileUrl } from '@shared/book'
import type { ReaderNovelUnit } from '@shared/reader'
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
}

export interface FoliateView extends HTMLElement {
  book: { toc?: FoliateTocItem[]; dir?: string; metadata?: { title?: string } }
  lastLocation: FoliateRelocation | null
  renderer: HTMLElement & { setStyles?: (css: string) => void; next: () => Promise<void> }
  open(book: unknown): Promise<void>
  close(): void
  init(options: { lastLocation?: string; showTextStart?: boolean }): Promise<void>
  goTo(target: string | number): Promise<unknown>
  goToFraction(fraction: number): Promise<unknown>
  goLeft(): Promise<unknown>
  goRight(): Promise<unknown>
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
  await import('../../../vendor/foliate-js/view.js')
  return document.createElement('foliate-view') as FoliateView
}

/**
 * Opens one volume file in the view: TXT through the local adapter, every
 * other container through foliate's own sniffing.
 *
 * The book is built here rather than inside `view.open` so its resource loader
 * can be tapped before any resource is fetched.
 */
export async function openNovelVolume(view: FoliateView, unit: ReaderNovelUnit): Promise<void> {
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

  const { makeBook } = await import('../../../vendor/foliate-js/view.js')
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

/** Content styles following the reader window's resolved theme tokens. */
export function buildNovelContentStyles(fontSizePercent: number): string {
  const rootStyles = getComputedStyle(document.documentElement)
  const background = rootStyles.getPropertyValue('--color-background').trim() || '#ffffff'
  const foreground = rootStyles.getPropertyValue('--color-foreground').trim() || '#111111'
  const accent = rootStyles.getPropertyValue('--color-primary').trim() || '#3b82f6'

  return `
    @namespace epub "http://www.idpf.org/2007/ops";
    html {
      background: ${background};
      color: ${foreground};
      font-size: ${fontSizePercent}%;
    }
    a:link, a:visited {
      color: ${accent};
    }
    p, li, blockquote, dd {
      line-height: 1.6;
      widows: 2;
      orphans: 2;
    }
    /* Footnote popovers and asides stay out of the main flow. */
    aside[epub|type~="endnote"],
    aside[epub|type~="footnote"],
    aside[epub|type~="note"],
    aside[epub|type~="rearnote"] {
      display: none;
    }
  `
}
