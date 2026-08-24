export function trimToUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Normalizes a scraped description before it is rendered as Markdown.
 *
 * IGDB summaries use leading spaces for visual alignment, which Markdown would
 * otherwise read as indented code blocks.
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

/**
 * A game's description, from its storyline and summary.
 *
 * IGDB writes both: the storyline is the in-world premise and the summary is
 * the catalogue blurb, so they are complementary rather than alternatives.
 */
export function buildGameDescription(
  storyline: string | null | undefined,
  summary: string | null | undefined
): string | undefined {
  const parts = [trimToUndefined(storyline), trimToUndefined(summary)].filter(
    (part): part is string => part !== undefined
  )

  return parts.length > 0 ? normalizeDescription(parts.join('\n\n')) : undefined
}
