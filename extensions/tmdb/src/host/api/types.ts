/**
 * Response shapes of the TMDB v3 endpoints this extension reads.
 *
 * Only the fields the mappers consume are declared, and every one of them is
 * optional or nullable unless TMDB guarantees it: these objects are untrusted
 * remote data, so the mappers must survive missing members.
 */

export interface TmdbPaged<TResult> {
  page?: number
  results?: TResult[]
  total_pages?: number
  total_results?: number
}

export interface TmdbGenre {
  id: number
  name?: string
}

export interface TmdbKeyword {
  id: number
  name?: string
}

export interface TmdbCompanySummary {
  id: number
  name?: string
  logo_path?: string | null
  origin_country?: string | null
}

export interface TmdbCollectionSummary {
  id: number
  name?: string
  poster_path?: string | null
  backdrop_path?: string | null
}

export interface TmdbImage {
  file_path?: string
  iso_639_1?: string | null
  vote_average?: number
  vote_count?: number
  width?: number
  height?: number
}

export interface TmdbImages {
  posters?: TmdbImage[]
  backdrops?: TmdbImage[]
  logos?: TmdbImage[]
  stills?: TmdbImage[]
  profiles?: TmdbImage[]
}

export interface TmdbExternalIds {
  imdb_id?: string | null
  tvdb_id?: number | null
  wikidata_id?: string | null
}

export interface TmdbSearchMovie {
  id: number
  title?: string
  original_title?: string
  original_language?: string
  overview?: string | null
  release_date?: string | null
  poster_path?: string | null
  popularity?: number
  adult?: boolean
}

export interface TmdbSearchSeries {
  id: number
  name?: string
  original_name?: string
  original_language?: string
  overview?: string | null
  first_air_date?: string | null
  poster_path?: string | null
  popularity?: number
}

export interface TmdbSearchPerson {
  id: number
  name?: string
  original_name?: string
  known_for_department?: string
  profile_path?: string | null
  popularity?: number
}

export interface TmdbSearchCompany {
  id: number
  name?: string
  logo_path?: string | null
  origin_country?: string | null
}

export interface TmdbMovieDetail {
  id: number
  title?: string
  original_title?: string
  original_language?: string
  overview?: string | null
  release_date?: string | null
  runtime?: number | null
  homepage?: string | null
  imdb_id?: string | null
  adult?: boolean
  genres?: TmdbGenre[]
  production_companies?: TmdbCompanySummary[]
  belongs_to_collection?: TmdbCollectionSummary | null
  poster_path?: string | null
}

export interface TmdbSeasonSummary {
  id: number
  season_number: number
  name?: string
  overview?: string | null
  air_date?: string | null
  episode_count?: number
  poster_path?: string | null
}

export interface TmdbSeriesDetail {
  id: number
  name?: string
  original_name?: string
  original_language?: string
  overview?: string | null
  first_air_date?: string | null
  homepage?: string | null
  type?: string
  number_of_episodes?: number
  episode_run_time?: number[]
  genres?: TmdbGenre[]
  production_companies?: TmdbCompanySummary[]
  networks?: TmdbCompanySummary[]
  seasons?: TmdbSeasonSummary[]
  poster_path?: string | null
}

export interface TmdbEpisode {
  id: number
  name?: string
  overview?: string | null
  air_date?: string | null
  episode_number?: number
  season_number?: number
  runtime?: number | null
  show_id?: number
  order?: number
}

export interface TmdbSeasonDetail {
  id?: number
  season_number?: number
  name?: string
  overview?: string | null
  air_date?: string | null
  poster_path?: string | null
  episodes?: TmdbEpisode[]
}

export interface TmdbEpisodeGroupSummary {
  id: string
  name?: string
  description?: string | null
  episode_count?: number
  group_count?: number
  /** TMDB grouping kind: 1 original air date, 2 absolute, 3 DVD, and so on. */
  type?: number
}

export interface TmdbEpisodeGroupItem {
  id: string
  name?: string
  order?: number
  episodes?: TmdbEpisode[]
}

export interface TmdbEpisodeGroupDetail extends TmdbEpisodeGroupSummary {
  groups?: TmdbEpisodeGroupItem[]
}

export interface TmdbEpisodeGroupsResponse {
  id?: number
  results?: TmdbEpisodeGroupSummary[]
}

export interface TmdbMovieKeywords {
  keywords?: TmdbKeyword[]
}

export interface TmdbSeriesKeywords {
  results?: TmdbKeyword[]
}

/** One crew credit. Aggregate TV credits carry `jobs`, flat movie credits `job`. */
export interface TmdbCrewMember {
  id: number
  name?: string
  original_name?: string
  job?: string
  jobs?: { job?: string }[]
  department?: string
  known_for_department?: string
  gender?: number
  profile_path?: string | null
}

export interface TmdbCredits {
  crew?: TmdbCrewMember[]
}

export interface TmdbCollectionDetail {
  id: number
  name?: string
  overview?: string | null
  parts?: TmdbSearchMovie[]
}

export interface TmdbPersonDetail {
  id: number
  name?: string
  also_known_as?: string[]
  biography?: string | null
  birthday?: string | null
  deathday?: string | null
  gender?: number
  homepage?: string | null
  imdb_id?: string | null
  known_for_department?: string
  place_of_birth?: string | null
  profile_path?: string | null
}

export interface TmdbCompanyDetail {
  id: number
  name?: string
  description?: string | null
  headquarters?: string | null
  homepage?: string | null
  logo_path?: string | null
  origin_country?: string | null
}
