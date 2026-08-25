/**
 * Resume locators for fixed-layout volumes.
 *
 * Reflowable volumes resume from an EPUB CFI the text engine issues; a PDF has
 * no such coordinate, so its position is the page number written in a shape
 * that can never be mistaken for a CFI.
 */

const PAGE_LOCATOR_PREFIX = 'page:'

export function formatPageLocator(pageIndex: number): string {
  return `${PAGE_LOCATOR_PREFIX}${pageIndex}`
}

/** Zero-based page of a stored locator; null when it is not one. */
export function parsePageLocator(locator: string | null): number | null {
  if (!locator?.startsWith(PAGE_LOCATOR_PREFIX)) return null

  const parsed = Number.parseInt(locator.slice(PAGE_LOCATOR_PREFIX.length), 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}
