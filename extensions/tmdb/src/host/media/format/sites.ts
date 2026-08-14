import type { ExternalSite } from '@kisaki3/extension-sdk'
import { IMDB_SITE_BASE_URL, TMDB_SITE_BASE_URL } from '../../utils/constants'
import { trimToUndefined } from './text'

/** Site labels are provider names, not translatable copy. */
const TMDB_LABEL = 'TMDB'
const IMDB_LABEL = 'IMDb'
const HOMEPAGE_LABEL = 'Homepage'

export function tmdbMovieUrl(movieId: number): string {
  return `${TMDB_SITE_BASE_URL}/movie/${movieId}`
}

export function tmdbSeriesUrl(seriesId: number): string {
  return `${TMDB_SITE_BASE_URL}/tv/${seriesId}`
}

export function tmdbSeasonUrl(seriesId: number, seasonNumber: number): string {
  return `${tmdbSeriesUrl(seriesId)}/season/${seasonNumber}`
}

export function tmdbEpisodeGroupUrl(seriesId: number, setId: string, groupId: string): string {
  return `${tmdbSeriesUrl(seriesId)}/episode_group/${setId}/group/${groupId}`
}

export function tmdbPersonUrl(personId: number): string {
  return `${TMDB_SITE_BASE_URL}/person/${personId}`
}

export function tmdbCompanyUrl(companyId: number): string {
  return `${TMDB_SITE_BASE_URL}/company/${companyId}`
}

export function buildExternalSites(
  entries: readonly (ExternalSite | undefined)[]
): ExternalSite[] | undefined {
  const sites = entries.filter((site): site is ExternalSite => site !== undefined)
  return sites.length > 0 ? sites : undefined
}

export function tmdbSite(url: string): ExternalSite {
  return { label: TMDB_LABEL, url }
}

export function imdbTitleSite(imdbId: string | null | undefined): ExternalSite | undefined {
  const id = trimToUndefined(imdbId)
  return id ? { label: IMDB_LABEL, url: `${IMDB_SITE_BASE_URL}/title/${id}/` } : undefined
}

export function imdbNameSite(imdbId: string | null | undefined): ExternalSite | undefined {
  const id = trimToUndefined(imdbId)
  return id ? { label: IMDB_LABEL, url: `${IMDB_SITE_BASE_URL}/name/${id}/` } : undefined
}

export function homepageSite(homepage: string | null | undefined): ExternalSite | undefined {
  const url = trimToUndefined(homepage)
  return url ? { label: HOMEPAGE_LABEL, url } : undefined
}
