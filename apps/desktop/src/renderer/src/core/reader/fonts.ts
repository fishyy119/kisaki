/**
 * Installed font families, for the reading typography panel.
 *
 * The Local Font Access API answers only inside a user gesture and may be
 * refused outright, so this is best-effort: an unavailable list is an empty
 * list, and the panel falls back to naming a family by hand. A refusal is not
 * remembered, because the next attempt may well be the one made from a click.
 */

import { createLogger } from '@renderer/core/log'

const log = createLogger('Reader')

/** One face as reported by the platform; several faces share one family. */
interface LocalFontFace {
  family: string
}

declare global {
  interface Window {
    queryLocalFonts?: () => Promise<LocalFontFace[]>
  }
}

let families: string[] = []

/** Installed families in display order; empty when they cannot be enumerated. */
export async function listInstalledFontFamilies(): Promise<string[]> {
  if (families.length > 0) return families
  families = await readFontFamilies()
  return families
}

async function readFontFamilies(): Promise<string[]> {
  const query = window.queryLocalFonts
  if (typeof query !== 'function') return []

  try {
    const faces = await query()
    const unique = [...new Set(faces.map((face) => face.family))]
    return unique.sort((left, right) => left.localeCompare(right))
  } catch (error) {
    log.warn('Could not enumerate the installed fonts.', error)
    return []
  }
}

/**
 * Quotes a family name for a CSS font-family list.
 *
 * Installed names carry spaces and punctuation the property would otherwise
 * misread, and the stored value is used verbatim as CSS.
 */
export function formatFontFamilyValue(family: string): string {
  return `"${family.replaceAll('"', '')}"`
}
