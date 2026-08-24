export function trimToUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Normalizes a scraped description before it is rendered as Markdown.
 *
 * YMGal introductions use leading spaces for visual alignment, which Markdown
 * would otherwise read as indented code blocks.
 */
export function normalizeDescription(value: string | null | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined
  }

  const lines = value.replace(/\r\n?/g, '\n').split('\n')
  const normalizedLines: string[] = []
  let previousLineBlank = true

  for (const rawLine of lines) {
    const line = rawLine.replace(/[ \t]+$/g, '')

    if (!line.trim()) {
      if (!previousLineBlank) {
        normalizedLines.push('')
      }
      previousLineBlank = true
      continue
    }

    normalizedLines.push(previousLineBlank ? line.replace(/^[ \t]{4,}/, '') : line)
    previousLineBlank = false
  }

  return trimToUndefined(normalizedLines.join('\n'))
}
