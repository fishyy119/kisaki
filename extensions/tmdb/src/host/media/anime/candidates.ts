import type { AnimeScraperLookup, AnimeSearchResult, LibraryAnimeFormat } from '@kisaki3/extension-sdk'

/**
 * Pick the row a name search was meant to land on.
 *
 * TMDB answers one name with every season of a show plus its specials
 * collection and its films, so the first row is only ever right by accident:
 * seasons come back in number order, which puts the specials collection
 * (season 0) ahead of season 1. The lookup's facts rank the rows instead — the
 * format says which kind of entry to look for, the release date says which one
 * of that kind — and rows the facts cannot separate keep the order the search
 * gave them, which is by popularity and then by season.
 */
export function selectTmdbAnimeCandidate(
  candidates: readonly AnimeSearchResult[],
  lookup: AnimeScraperLookup
): AnimeSearchResult | null {
  let best: AnimeSearchResult | null = null
  let bestRank = -1

  for (const candidate of candidates) {
    const rank = rankCandidate(candidate, lookup)
    if (rank > bestRank) {
      best = candidate
      bestRank = rank
    }
  }

  return best
}

/** Format outranks date: the kind of entry narrows harder than the year does. */
function rankCandidate(candidate: AnimeSearchResult, lookup: AnimeScraperLookup): number {
  return rankFormat(candidate.format, lookup.format) * 3 + rankReleaseYear(candidate, lookup)
}

/**
 * TMDB states only three formats: `movie`, `special` for the specials
 * collection, and `tv` for every ordinary season. An entry the library calls an
 * OVA or ONA therefore lives here as an ordinary season, so anything but a
 * specials collection stays plausible for it.
 */
function rankFormat(
  candidate: LibraryAnimeFormat | undefined,
  wanted: LibraryAnimeFormat | undefined
): number {
  if (wanted !== undefined && candidate === wanted) {
    return 2
  }

  // Specials are what a name search offers that a caller almost never means,
  // so they rank last unless they were asked for.
  return candidate === 'special' ? 0 : 1
}

function rankReleaseYear(candidate: AnimeSearchResult, lookup: AnimeScraperLookup): number {
  const wanted = lookup.releaseDate?.year
  const actual = candidate.releaseDate?.year
  if (wanted === undefined || actual === undefined) {
    return 1
  }

  return actual === wanted ? 2 : 0
}
