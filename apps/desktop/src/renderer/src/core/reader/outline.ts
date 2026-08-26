/**
 * Outlines of a readable unit.
 *
 * A unit names places inside itself in one of two ways — an EPUB table of
 * contents addressed by href, or a PDF outline addressed by page — and the
 * reader navigates both through this one shape.
 */

import type { FoliateTocItem } from './foliate'

export interface ReaderOutlineEntry {
  /** Engine-scoped destination: a TOC href, or a zero-based page index. */
  target: string | number
  label: string
  /** Nesting level in the original tree; zero for top-level entries. */
  depth: number
}

/** Flattens a book's table of contents, keeping reading order and nesting. */
export function flattenTocOutline(items: FoliateTocItem[], depth = 0): ReaderOutlineEntry[] {
  const entries: ReaderOutlineEntry[] = []

  for (const item of items) {
    entries.push({ target: item.href, label: item.label?.trim() || item.href, depth })
    if (item.subitems?.length) {
      entries.push(...flattenTocOutline(item.subitems, depth + 1))
    }
  }

  return entries
}
