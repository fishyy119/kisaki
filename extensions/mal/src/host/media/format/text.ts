/**
 * MAL synopses end with attribution markers such as "[Written by MAL
 * Rewrite]" and carry "(Source: ...)" credits; the markers are boilerplate,
 * the credits are content and stay.
 */
export function normalizeSynopsis(value: string | null | undefined): string | undefined {
  const raw = value?.trim()
  if (!raw) {
    return undefined
  }

  const text = raw
    .replace(/\[Written by MAL Rewrite\]\s*$/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text || undefined
}

export function trimToUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * MAL formats person and character names as "Family, Given"; the display
 * order is the natural one. Names without a comma pass through unchanged.
 */
export function formatMalName(value: string | null | undefined): string | undefined {
  const raw = trimToUndefined(value)
  if (!raw) {
    return undefined
  }

  const commaIndex = raw.indexOf(', ')
  if (commaIndex === -1) {
    return raw
  }

  const family = raw.slice(0, commaIndex).trim()
  const given = raw.slice(commaIndex + 2).trim()
  return given ? `${given} ${family}` : family
}
