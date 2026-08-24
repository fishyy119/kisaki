import type { ScrapedTag } from '@kisaki3/extension-sdk'
import { trimToUndefined } from './text'

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
    output.push({
      name,
      ...(note ? { note } : {}),
      ...(tag.isSpoiler ? { isSpoiler: true } : {}),
      ...(tag.isNsfw ? { isNsfw: true } : {})
    })
  }

  return output
}

/** VNDB grades spoilers and sexual content from 0; anything above is a flag. */
export function isFlagged(value: number | null | undefined): boolean {
  return typeof value === 'number' && value > 0
}
