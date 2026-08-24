import type { ScrapedTag } from '@kisaki3/extension-sdk'
import { trimToUndefined } from './text'

/** Note text is a stable machine-readable qualifier, not translatable copy. */
const COUNTRY_NOTE = 'Country'

/** The country an archive states, as a tag; empty when it states none. */
export function buildCountryTags(country: string | null | undefined): ScrapedTag[] {
  const name = trimToUndefined(country)
  return name ? [{ name, note: COUNTRY_NOTE }] : []
}

export function dedupeTags(tags: readonly ScrapedTag[]): ScrapedTag[] {
  const seen = new Set<string>()
  const output: ScrapedTag[] = []

  for (const tag of tags) {
    const name = trimToUndefined(tag.name)
    if (!name) {
      continue
    }

    const note = trimToUndefined(tag.note)
    const key = `${name.toLowerCase()}::${note?.toLowerCase() ?? ''}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    output.push(note ? { name, note } : { name })
  }

  return output
}
