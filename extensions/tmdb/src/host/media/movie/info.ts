import type { ScrapedMovieInfo } from '@kisaki3/extension-sdk'
import type { TmdbMovieLoaders } from '../loaders'
import { omitUndefined } from '../../utils/object'
import { parseTmdbDate, toDurationMs } from '../format/dates'
import { readTmdbGenreIds, readTmdbMovieFormat } from '../format/formats'
import { readMovieNames } from '../format/names'
import {
  buildExternalSites,
  homepageSite,
  imdbTitleSite,
  tmdbMovieUrl,
  tmdbSite
} from '../format/sites'
import { trimToUndefined } from '../format/text'

export async function buildMovieInfo(loaders: TmdbMovieLoaders): Promise<ScrapedMovieInfo> {
  const movie = await loaders.getMovie()

  return omitUndefined({
    ...readMovieNames(movie),
    releaseDate: parseTmdbDate(movie.release_date),
    description: trimToUndefined(movie.overview),
    format: readTmdbMovieFormat(readTmdbGenreIds(movie.genres), movie.runtime),
    runtimeMs: toDurationMs(movie.runtime),
    externalSites: buildExternalSites([
      tmdbSite(tmdbMovieUrl(movie.id)),
      imdbTitleSite(movie.imdb_id),
      homepageSite(movie.homepage)
    ])
  })
}
