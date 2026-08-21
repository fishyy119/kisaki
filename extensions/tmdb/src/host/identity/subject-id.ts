/**
 * TMDB entry identity grammar.
 *
 * An external id names *which slice of TMDB* an entry mirrors, so a re-scrape
 * reproduces the exact same ordering and switching orderings is just a
 * different id on the same entry.
 *
 *   movie:{movieId}                        one film
 *   tv:{seriesId}                          the whole show
 *   tv:{seriesId}:s{seasonNumber}          one season
 *   tv:{seriesId}:eg:{setId}:{groupId}     one group of an episode group
 *
 * `movie` and `tv` here are TMDB's own namespaces, not library media types. An
 * anime entry is one flat episode list, so it binds to whichever slice of a
 * series matches it; the whole-show form flattens seasons into one run.
 *
 * Everything here is a pure function over strings: no library or TMDB API
 * concepts leak in, so the grammar survives changes to either side.
 */

export interface TmdbMovieRef {
  kind: 'movie'
  movieId: number
}

export interface TmdbSeriesRef {
  kind: 'series'
  seriesId: number
}

export interface TmdbSeasonRef {
  kind: 'season'
  seriesId: number
  seasonNumber: number
}

export interface TmdbEpisodeGroupRef {
  kind: 'episodeGroup'
  seriesId: number
  /** The episode group holding it; TMDB only serves whole episode groups. */
  setId: string
  /**
   * The group's own TMDB id. Position would be shorter but not stable: adding
   * or reordering a group would silently repoint every entry after it.
   */
  groupId: string
}

/** An id that can identify a library entry. */
export type TmdbSubjectRef = TmdbMovieRef | TmdbSeriesRef | TmdbSeasonRef | TmdbEpisodeGroupRef

/**
 * An episode group as a whole. It names a set of orderings rather than one
 * ordering, so it cannot be an entry id; search expands it into its groups.
 */
export interface TmdbEpisodeGroupSetRef {
  kind: 'episodeGroupSet'
  setId: string
}

/** Anything a pasted id or themoviedb.org link can point at. */
export type TmdbRef = TmdbSubjectRef | TmdbEpisodeGroupSetRef

const MOVIE_PATTERN = /^movie:(\d+)$/
const SERIES_PATTERN = /^tv:(\d+)$/
const SEASON_PATTERN = /^tv:(\d+):s(\d+)$/
const EPISODE_GROUP_PATTERN = /^tv:(\d+):eg:([a-z0-9]+):([a-z0-9]+)$/
const EPISODE_GROUP_SET_PATTERN = /^eg:([a-z0-9]+)$/
const OBJECT_ID_PATTERN = /^[a-z0-9]+$/

export function formatTmdbSubjectId(ref: TmdbSubjectRef): string {
  switch (ref.kind) {
    case 'movie':
      return `movie:${ref.movieId}`
    case 'series':
      return `tv:${ref.seriesId}`
    case 'season':
      return `tv:${ref.seriesId}:s${ref.seasonNumber}`
    case 'episodeGroup':
      return `tv:${ref.seriesId}:eg:${ref.setId}:${ref.groupId}`
  }
}

/** Parses the canonical id grammar only; links go through {@link parseTmdbRef}. */
export function parseTmdbSubjectId(value: string): TmdbSubjectRef | null {
  const input = value.trim().toLowerCase()

  const movie = MOVIE_PATTERN.exec(input)
  if (movie) {
    return { kind: 'movie', movieId: Number(movie[1]) }
  }

  const episodeGroup = EPISODE_GROUP_PATTERN.exec(input)
  if (episodeGroup) {
    return {
      kind: 'episodeGroup',
      seriesId: Number(episodeGroup[1]),
      setId: episodeGroup[2]!,
      groupId: episodeGroup[3]!
    }
  }

  const season = SEASON_PATTERN.exec(input)
  if (season) {
    return { kind: 'season', seriesId: Number(season[1]), seasonNumber: Number(season[2]) }
  }

  const series = SERIES_PATTERN.exec(input)
  if (series) {
    return { kind: 'series', seriesId: Number(series[1]) }
  }

  return null
}

/**
 * Reads an id typed by hand or carried by an existing entry.
 *
 * Beyond the grammar this accepts a bare number, which for a series entry is a
 * show, and a themoviedb.org link, so a slice picked on the site can be pasted
 * as found. An episode group as a whole is refused: it names a set of orderings
 * rather than one, and search is where it becomes a choice.
 */
export function parseTmdbEntryId(value: string): TmdbSubjectRef | null {
  const input = value.trim()
  const bareId = /^(\d+)$/.exec(input)
  if (bareId) {
    return { kind: 'series', seriesId: Number(bareId[1]) }
  }

  const ref = parseTmdbRef(input)
  return ref && ref.kind !== 'episodeGroupSet' ? ref : null
}

/**
 * Parses anything a user can paste: a canonical id, a bare episode group id,
 * or a themoviedb.org link.
 */
export function parseTmdbRef(value: string): TmdbRef | null {
  const input = value.trim()
  if (!input) {
    return null
  }

  const subject = parseTmdbSubjectId(input)
  if (subject) {
    return subject
  }

  const groupSet = EPISODE_GROUP_SET_PATTERN.exec(input.toLowerCase())
  if (groupSet) {
    return { kind: 'episodeGroupSet', setId: groupSet[1]! }
  }

  return parseTmdbUrl(input)
}

/**
 * Reads a themoviedb.org link.
 *
 * TMDB slugs ids as `1429-attack-on-titan`, and localized links carry a
 * `/{locale}` prefix, so segments are matched by position after the media
 * keyword rather than by a fixed path.
 */
export function parseTmdbUrl(value: string): TmdbRef | null {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }

  if (!/(^|\.)themoviedb\.org$/i.test(url.hostname)) {
    return null
  }

  const segments = url.pathname.split('/').filter(Boolean)
  const mediaIndex = segments.findIndex((segment) => segment === 'movie' || segment === 'tv')
  if (mediaIndex < 0) {
    return null
  }

  const id = readLeadingId(segments[mediaIndex + 1])
  if (id === null) {
    return null
  }

  if (segments[mediaIndex] === 'movie') {
    return { kind: 'movie', movieId: id }
  }

  const scope = segments[mediaIndex + 2]
  if (scope === 'season') {
    const seasonNumber = readLeadingId(segments[mediaIndex + 3])
    return seasonNumber === null
      ? { kind: 'series', seriesId: id }
      : { kind: 'season', seriesId: id, seasonNumber }
  }

  if (scope === 'episode_groups' || scope === 'episode_group') {
    const setId = readObjectId(segments[mediaIndex + 3])
    if (!setId) {
      return { kind: 'series', seriesId: id }
    }

    // A group page carries both ids: .../episode_group/{setId}/group/{groupId}
    const groupId =
      segments[mediaIndex + 4] === 'group' ? readObjectId(segments[mediaIndex + 5]) : undefined

    return groupId
      ? { kind: 'episodeGroup', seriesId: id, setId, groupId }
      : { kind: 'episodeGroupSet', setId }
  }

  return { kind: 'series', seriesId: id }
}

/** The series a reference belongs to, when it names one. */
export function readTmdbSeriesId(ref: TmdbRef): number | null {
  switch (ref.kind) {
    case 'series':
    case 'season':
    case 'episodeGroup':
      return ref.seriesId
    case 'movie':
    case 'episodeGroupSet':
      return null
  }
}

function readLeadingId(segment: string | undefined): number | null {
  const match = /^(\d+)/.exec(segment?.trim() ?? '')
  return match ? Number(match[1]) : null
}

/** TMDB ids an episode group and its groups as hex object ids. */
function readObjectId(segment: string | undefined): string | undefined {
  const value = segment?.trim().toLowerCase() ?? ''
  return OBJECT_ID_PATTERN.test(value) ? value : undefined
}
