import type { PartialDate } from '@kisaki3/extension-sdk'

/** What ranking reads off a search row; every media type states at least this. */
interface RankableCandidate {
  format?: string
  releaseDate?: PartialDate
}

/** What ranking reads off the lookup the host asked with. */
interface RankableLookup {
  format?: string
  releaseDate?: PartialDate
}

/** Which fact breaks the tie when format and release year disagree. */
export type CandidatePriority = 'format' | 'releaseYear'

/**
 * Pick the row a name search was meant to land on.
 *
 * A name search answers with everything that carries the name, so the first row
 * is only ever right by accident. The lookup's facts rank the rows instead —
 * the format says which kind of entry to look for, the release date says which
 * one of that kind — and rows the facts cannot separate keep the order the
 * search gave them, which is by popularity.
 *
 * Which fact leads is the caller's to state, and must match how the host ranks
 * the same candidates: for shows the format narrows harder, while entries of a
 * film series differ by year rather than by kind.
 */
export function selectTmdbCandidate<TCandidate extends RankableCandidate>(
  candidates: readonly TCandidate[],
  lookup: RankableLookup,
  priority: CandidatePriority = 'format'
): TCandidate | null {
  let best: TCandidate | null = null
  let bestRank = -1

  for (const candidate of candidates) {
    const rank = rankCandidate(candidate, lookup, priority)
    if (rank > bestRank) {
      best = candidate
      bestRank = rank
    }
  }

  return best
}

function rankCandidate(
  candidate: RankableCandidate,
  lookup: RankableLookup,
  priority: CandidatePriority
): number {
  const format = rankFact(candidate.format, lookup.format)
  const releaseYear = rankFact(candidate.releaseDate?.year, lookup.releaseDate?.year)

  return priority === 'format' ? format * 3 + releaseYear : releaseYear * 3 + format
}

/** An unstated fact is neutral: it neither confirms nor rules a row out. */
function rankFact<T>(candidate: T | undefined, wanted: T | undefined): number {
  if (candidate === undefined || wanted === undefined) {
    return 1
  }

  return candidate === wanted ? 2 : 0
}
