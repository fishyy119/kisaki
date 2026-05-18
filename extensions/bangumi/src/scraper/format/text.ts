export function normalizeKeyText(value: string | null | undefined): string {
  return (value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function normalizeDescription(value: string | null | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined
  }

  const lines = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
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

    const normalizedLine = previousLineBlank ? line.replace(/^[ \t]{4,}/, '') : line
    normalizedLines.push(normalizedLine)
    previousLineBlank = false
  }

  const normalized = normalizedLines.join('\n').trim()
  return normalized || undefined
}

export function normalizeToken(value: string | undefined | null): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s·・:：/_-]+/g, '')
}
