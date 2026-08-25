/**
 * Page grouping for the fixed-layout reading engine.
 *
 * A slot is what one screen shows: a single page, or the two pages of a
 * spread. Print comics open on a standalone cover, so a spread that starts at
 * page 0 pairs every later page with the wrong partner; the cover offset is a
 * per-entry choice the reader exposes rather than a fixed rule.
 */

/** Zero-based page indexes shown together, in reading order. */
export type PageSlot = readonly number[]

export function buildPageSlots(
  pageCount: number,
  spread: boolean,
  coverAlone: boolean
): PageSlot[] {
  if (pageCount <= 0) return []
  if (!spread) return Array.from({ length: pageCount }, (_, index) => [index])

  const slots: PageSlot[] = []
  let index = 0

  if (coverAlone) {
    slots.push([0])
    index = 1
  }

  for (; index < pageCount; index += 2) {
    slots.push(index + 1 < pageCount ? [index, index + 1] : [index])
  }

  return slots
}

/** Slot showing a page, or 0 when the page is out of range. */
export function findSlotIndex(slots: readonly PageSlot[], pageIndex: number): number {
  const found = slots.findIndex((slot) => slot.includes(pageIndex))
  return found === -1 ? 0 : found
}
