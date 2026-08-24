/**
 * IGDB entry ids.
 *
 * Every entity kind is numbered with a plain positive integer in its own
 * space. Ids arrive from search payloads, from stored external ids, and from
 * users typing them, so parsing is total and returns the numeric form the
 * Apicalypse queries need.
 */

export function parseIgdbEntryId(value: string): number | null {
  const match = /^(\d+)$/.exec(value.trim())
  if (!match) {
    return null
  }

  const id = Number(match[1])
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
