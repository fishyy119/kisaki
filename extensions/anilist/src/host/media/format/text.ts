/**
 * AniList descriptions mix light HTML (`<br>`, `<i>`) with markdown links and
 * emphasis; the library stores plain text, so both notations are flattened.
 */
export function normalizeDescription(value: string | null | undefined): string | undefined {
  const raw = value?.trim()
  if (!raw) {
    return undefined
  }

  const text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/~!([\s\S]*?)!~/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text || undefined
}

export function trimToUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
