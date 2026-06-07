import type { ExternalId, ScrapedTag } from '@kisaki3/extension-sdk'
import { omitUndefined } from '../../../../shared/object'

export function dedupeExternalIds(ids: ExternalId[]): ExternalId[] {
  const seen = new Set<string>()
  const result: ExternalId[] = []

  for (const id of ids) {
    const source = id.source?.trim().toLowerCase()
    const value = id.id?.trim()
    if (!source || !value) continue

    const key = `${source}:${value}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ source, id: value })
  }

  return result
}

export function dedupeTags(tags: ScrapedTag[]): ScrapedTag[] {
  const seen = new Set<string>()
  const result: ScrapedTag[] = []

  for (const tag of tags) {
    const name = tag.name?.trim()
    if (!name) continue
    const note = tag.note?.trim() || ''
    const key = `${name.toLowerCase()}::${note.toLowerCase()}::${tag.isNsfw ? 'nsfw' : ''}::${tag.isSpoiler ? 'spoiler' : ''}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(
      omitUndefined({
        ...tag,
        name,
        note: note || undefined
      })
    )
  }

  return result
}
