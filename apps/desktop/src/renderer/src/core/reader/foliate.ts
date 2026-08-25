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

export async function createFoliateView(): Promise<FoliateView> {
  await import('../../../vendor/foliate-js/view.js')
  return document.createElement('foliate-view') as FoliateView
}

/**
 * Opens one volume file in the view: TXT through the local adapter, every
 * other container through foliate's own sniffing (`makeBook`).
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
    const text = await response.text()
    await view.open(makeTxtBook(text, unit.label))
    return
  }

  const blob = await response.blob()
  const file = new File([blob], `volume.${unit.container ?? 'epub'}`)
  await view.open(file)
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
