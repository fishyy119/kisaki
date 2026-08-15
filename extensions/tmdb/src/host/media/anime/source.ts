import type { AnimeScraperSlot, AnimeSessionResultMap } from '@kisaki3/extension-sdk'
import type { TmdbMovieRef, TmdbSubjectRef } from '../../identity/subject-id'
import { toImageContext } from '../runtime'
import { buildAnimeCompanyFacts } from '../format/companies'
import { buildAnimePersonFacts } from '../format/credits'
import {
  buildImageUrl,
  dedupeUrls,
  selectBackdropUrls,
  selectLogoUrls,
  selectPosterUrls
} from '../format/images'
import { buildTags } from '../format/tags'
import type { TmdbMovieLoaders, TmdbRequestContext, TmdbSeriesLoaders } from '../loaders'
import {
  buildEpisodeGroupEpisodes,
  buildMovieEpisodes,
  buildSeasonEpisodes,
  buildSeriesEpisodes
} from './episodes'
import { buildEpisodeGroupInfo, buildMovieInfo, buildSeasonInfo, buildSeriesInfo } from './info'
import { buildEpisodeGroupRelated, buildMovieRelated, buildSeasonRelated } from './related'

/** TMDB has no character entity, so that slot is not part of any source. */
export type TmdbAnimeSlot = Exclude<AnimeScraperSlot, 'characters'>

/**
 * The slots one TMDB reference can answer.
 *
 * A film and a show differ in every read, and the three slices of a show
 * differ in a few, so each reference gets its own reader set and the session
 * only has to route slot names.
 */
export type TmdbAnimeSource = {
  [TSlot in TmdbAnimeSlot]: () => Promise<AnimeSessionResultMap[TSlot]>
}

export function createMovieSource(
  loaders: TmdbMovieLoaders,
  ctx: TmdbRequestContext
): TmdbAnimeSource {
  const images = toImageContext(ctx)

  return {
    info: () => buildMovieInfo(loaders),
    tags: async () => buildTags((await loaders.getMovie()).genres, await loaders.getKeywords()),
    episodes: () => buildMovieEpisodes(loaders),
    persons: async () => buildAnimePersonFacts(await loaders.getCredits(), ctx.imageBaseUrl),
    companies: async () =>
      buildAnimeCompanyFacts(
        (await loaders.getMovie()).production_companies,
        undefined,
        ctx.imageBaseUrl
      ),
    relatedEntries: () => buildMovieRelated(loaders),
    covers: async () => {
      const [movie, artwork] = await Promise.all([loaders.getMovie(), loaders.getImages()])
      return dedupeUrls([
        ...selectPosterUrls(artwork, images),
        buildImageUrl(ctx.imageBaseUrl, movie.poster_path)
      ])
    },
    backdrops: async () => selectBackdropUrls(await loaders.getImages(), images),
    logos: async () => selectLogoUrls(await loaders.getImages(), images)
  }
}

/**
 * Readers for a show, whichever slice of it the entry mirrors.
 *
 * Everything a slice does not redefine is read from the show: TMDB describes
 * cast, artwork, and genres once per show, not once per season or ordering.
 */
export function createSeriesSource(
  ref: Exclude<TmdbSubjectRef, TmdbMovieRef>,
  loaders: TmdbSeriesLoaders,
  ctx: TmdbRequestContext
): TmdbAnimeSource {
  const images = toImageContext(ctx)

  return {
    info: () => {
      switch (ref.kind) {
        case 'series':
          return buildSeriesInfo(ref, loaders)
        case 'season':
          return buildSeasonInfo(ref, loaders)
        case 'episodeGroup':
          return buildEpisodeGroupInfo(ref, loaders)
      }
    },
    tags: async () => buildTags((await loaders.getSeries()).genres, await loaders.getKeywords()),
    episodes: () => {
      switch (ref.kind) {
        case 'series':
          return buildSeriesEpisodes(loaders)
        case 'season':
          return buildSeasonEpisodes(ref, loaders)
        case 'episodeGroup':
          return buildEpisodeGroupEpisodes(ref, loaders)
      }
    },
    persons: async () => buildAnimePersonFacts(await loaders.getCredits(), ctx.imageBaseUrl),
    companies: async () => {
      const series = await loaders.getSeries()
      return buildAnimeCompanyFacts(series.production_companies, series.networks, ctx.imageBaseUrl)
    },
    relatedEntries: () => {
      switch (ref.kind) {
        case 'series':
          return Promise.resolve([])
        case 'season':
          return buildSeasonRelated(ref, loaders)
        case 'episodeGroup':
          return buildEpisodeGroupRelated(ref, loaders)
      }
    },
    covers: async () => {
      const [series, artwork, season] = await Promise.all([
        loaders.getSeries(),
        loaders.getImages(),
        // A season is the one slice TMDB gives its own poster.
        ref.kind === 'season' ? loaders.getSeasonImages(ref.seasonNumber) : undefined
      ])

      return dedupeUrls([
        ...selectPosterUrls(season, images),
        ...selectPosterUrls(artwork, images),
        buildImageUrl(ctx.imageBaseUrl, series.poster_path)
      ])
    },
    backdrops: async () => selectBackdropUrls(await loaders.getImages(), images),
    logos: async () => selectLogoUrls(await loaders.getImages(), images)
  }
}
