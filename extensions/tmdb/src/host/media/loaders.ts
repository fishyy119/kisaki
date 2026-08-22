import type { TmdbClient } from '../api/client'
import type {
  TmdbAlternativeTitle,
  TmdbCollectionDetail,
  TmdbCompanyDetail,
  TmdbCredits,
  TmdbEpisodeGroupDetail,
  TmdbEpisodeGroupSummary,
  TmdbExternalIds,
  TmdbImages,
  TmdbKeyword,
  TmdbMovieDetail,
  TmdbPersonDetail,
  TmdbSeasonDetail,
  TmdbSeriesDetail
} from '../api/types'

/** Request shaping shared by every read of one scraping session. */
export interface TmdbRequestContext {
  /** TMDB `language` tag derived from the session content locale. */
  language: string
  /** ISO-639-1 codes accepted for artwork, in preference order. */
  imageLanguages: readonly string[]
  /** ISO-3166-1 codes whose alternative titles read as the locale's own. */
  titleCountries: readonly string[]
  imageBaseUrl: string
  signal: AbortSignal
}

export interface TmdbSeriesLoaders {
  getSeries(): Promise<TmdbSeriesDetail>
  getImages(): Promise<TmdbImages>
  getCredits(): Promise<TmdbCredits>
  getKeywords(): Promise<TmdbKeyword[]>
  getAlternativeTitles(): Promise<TmdbAlternativeTitle[]>
  getExternalIds(): Promise<TmdbExternalIds>
  getEpisodeGroupSummaries(): Promise<TmdbEpisodeGroupSummary[]>
  getSeason(seasonNumber: number): Promise<TmdbSeasonDetail>
  /** The season as the show's own language titles it; see `createSeriesLoaders`. */
  getNativeSeason(seasonNumber: number): Promise<TmdbSeasonDetail>
  getSeasonImages(seasonNumber: number): Promise<TmdbImages>
  getEpisodeGroup(setId: string): Promise<TmdbEpisodeGroupDetail>
}

export interface TmdbMovieLoaders {
  getMovie(): Promise<TmdbMovieDetail>
  getImages(): Promise<TmdbImages>
  getCredits(): Promise<TmdbCredits>
  getKeywords(): Promise<TmdbKeyword[]>
  getAlternativeTitles(): Promise<TmdbAlternativeTitle[]>
  getCollection(collectionId: number): Promise<TmdbCollectionDetail>
}

export interface TmdbPersonLoaders {
  getPerson(): Promise<TmdbPersonDetail>
  getImages(): Promise<TmdbImages>
}

export interface TmdbCompanyLoaders {
  getCompany(): Promise<TmdbCompanyDetail>
  getImages(): Promise<TmdbImages>
}

/**
 * Memoized readers for one TV series.
 *
 * A season entry, the whole show, and an episode group all draw on the same
 * series detail, and several slots read the same sub-resources, so each read
 * happens once per session no matter how many slots the profile asks for.
 */
export function createSeriesLoaders(
  client: TmdbClient,
  seriesId: number,
  ctx: TmdbRequestContext
): TmdbSeriesLoaders {
  const request = { language: ctx.language, signal: ctx.signal }
  const imageRequest = { imageLanguages: ctx.imageLanguages, signal: ctx.signal }

  const getSeries = memoize(() => client.getSeries(seriesId, request))
  const getSeason = memoizeBy(String, (seasonNumber: number) =>
    client.getSeason(seriesId, seasonNumber, request)
  )

  return {
    getSeries,
    getImages: memoize(() => client.getSeriesImages(seriesId, imageRequest)),
    getCredits: memoize(() => client.getSeriesAggregateCredits(seriesId, request)),
    getKeywords: memoize(
      async () => (await client.getSeriesKeywords(seriesId, request)).results ?? []
    ),
    getAlternativeTitles: memoize(
      async () => (await client.getSeriesAlternativeTitles(seriesId, request)).results ?? []
    ),
    getExternalIds: memoize(() => client.getSeriesExternalIds(seriesId, request)),
    getEpisodeGroupSummaries: memoize(
      async () => (await client.getEpisodeGroups(seriesId, request)).results ?? []
    ),
    getSeason,
    // TMDB carries no original title for a season, so a native title needs a
    // second read in the show's own language. The session read already is that
    // read when the two languages agree.
    getNativeSeason: memoizeBy(String, async (seasonNumber: number) => {
      const language = (await getSeries()).original_language
      if (!language || sharesBaseLanguage(language, ctx.language)) {
        return getSeason(seasonNumber)
      }

      return client.getSeason(seriesId, seasonNumber, { language, signal: ctx.signal })
    }),
    getSeasonImages: memoizeBy(String, (seasonNumber: number) =>
      client.getSeasonImages(seriesId, seasonNumber, imageRequest)
    ),
    getEpisodeGroup: memoizeBy(
      (setId: string) => setId,
      (setId: string) => client.getEpisodeGroup(setId, request)
    )
  }
}

export function createMovieLoaders(
  client: TmdbClient,
  movieId: number,
  ctx: TmdbRequestContext
): TmdbMovieLoaders {
  const request = { language: ctx.language, signal: ctx.signal }

  return {
    getMovie: memoize(() => client.getMovie(movieId, request)),
    getImages: memoize(() =>
      client.getMovieImages(movieId, { imageLanguages: ctx.imageLanguages, signal: ctx.signal })
    ),
    getCredits: memoize(() => client.getMovieCredits(movieId, request)),
    getKeywords: memoize(
      async () => (await client.getMovieKeywords(movieId, request)).keywords ?? []
    ),
    getAlternativeTitles: memoize(
      async () => (await client.getMovieAlternativeTitles(movieId, request)).titles ?? []
    ),
    getCollection: memoizeBy(String, (collectionId: number) =>
      client.getCollection(collectionId, request)
    )
  }
}

export function createPersonLoaders(
  client: TmdbClient,
  personId: number,
  ctx: TmdbRequestContext
): TmdbPersonLoaders {
  const request = { language: ctx.language, signal: ctx.signal }

  return {
    getPerson: memoize(() => client.getPerson(personId, request)),
    getImages: memoize(() => client.getPersonImages(personId, request))
  }
}

export function createCompanyLoaders(
  client: TmdbClient,
  companyId: number,
  ctx: TmdbRequestContext
): TmdbCompanyLoaders {
  const request = { language: ctx.language, signal: ctx.signal }

  return {
    getCompany: memoize(() => client.getCompany(companyId, request)),
    getImages: memoize(() => client.getCompanyImages(companyId, request))
  }
}

/** Whether a bare language code is the one a TMDB language tag asks for. */
function sharesBaseLanguage(language: string, tag: string): boolean {
  return language.toLowerCase() === tag.split('-')[0]!.toLowerCase()
}

function memoize<T>(loader: () => Promise<T>): () => Promise<T> {
  let task: Promise<T> | undefined

  return () => {
    task ??= loader()
    return task
  }
}

function memoizeBy<TArg, TResult>(
  toKey: (arg: TArg) => string,
  loader: (arg: TArg) => Promise<TResult>
): (arg: TArg) => Promise<TResult> {
  const tasks = new Map<string, Promise<TResult>>()

  return (arg) => {
    const key = toKey(arg)
    const existing = tasks.get(key)
    if (existing) {
      return existing
    }

    const task = loader(arg)
    tasks.set(key, task)
    return task
  }
}
