export function trimToUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Converts VNDB's own markup dialect into plain text the app renders as
 * Markdown.
 *
 * Descriptions are written in VNDB's `[tag]` syntax, which Markdown does not
 * understand. Links keep their target next to the label so the information
 * survives; every other tag is structural and is reduced to its content.
 */
export function sanitizeVndbText(value: string | null | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined
  }

  let text = value.replace(/\r\n?/g, '\n')

  text = text.replace(/\[raw\]([\s\S]*?)\[\/raw\]/gi, (_, content: string) => content)

  text = text.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, (_, url: string, label: string) => {
    const trimmedLabel = label.trim()
    const trimmedUrl = url.trim()
    if (!trimmedLabel) {
      return trimmedUrl
    }
    return !trimmedUrl || trimmedLabel === trimmedUrl
      ? trimmedLabel
      : `${trimmedLabel} (${trimmedUrl})`
  })
  text = text.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (_, link: string) => link.trim())

  text = text.replace(/\[(?:nl|br)\]/gi, '\n')
  text = text.replace(/\[\/?quote\]/gi, '\n')
  text = text.replace(/\[\/?list\]/gi, '')
  text = text.replace(/\[\*\]/g, '\n- ')
  text = text.replace(/\[\/?[a-z]+(?:=[^\]]+)?\]/gi, '')

  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')

  return trimToUndefined(text)
}

/** Joins two notes about one credit without losing either. */
export function mergeNotes(...notes: readonly (string | undefined)[]): string | undefined {
  const parts: string[] = []
  for (const note of notes) {
    const trimmed = note?.trim()
    if (trimmed && !parts.includes(trimmed)) {
      parts.push(trimmed)
    }
  }

  return parts.length > 0 ? parts.join('; ') : undefined
}
