import type { MovieScraperSlot, MovieSessionResultMap } from '@kisaki3/extension-sdk'
import type { TmdbMovieLoaders, TmdbRequestContext } from '../loaders'
import { toImageContext } from '../runtime'
import { buildMovieCompanyFacts } from '../format/companies'
import { buildMoviePersonFacts } from '../format/credits'
import {
  buildImageUrl,
  dedupeUrls,
  selectBackdropUrls,
  selectLogoUrls,
  selectPosterUrls
} from '../format/images'
import { buildTags } from '../format/tags'
import { buildMovieInfo } from './info'
import { buildMovieRelated } from './related'

/**
 * TMDB has no character entity, and a cast credit alone cannot name the
 * character it belongs to.
 */
export type TmdbMovieSlot = Exclude<MovieScraperSlot, 'characters'>

export type TmdbMovieSource = {
  [TSlot in TmdbMovieSlot]: () => Promise<MovieSessionResultMap[TSlot]>
}

export function createMovieSource(
  loaders: TmdbMovieLoaders,
  ctx: TmdbRequestContext
): TmdbMovieSource {
  const images = toImageContext(ctx)

  return {
    info: () => buildMovieInfo(loaders),
    tags: async () => buildTags((await loaders.getMovie()).genres, await loaders.getKeywords()),
    persons: async () => buildMoviePersonFacts(await loaders.getCredits(), ctx.imageBaseUrl),
    companies: async () =>
      buildMovieCompanyFacts((await loaders.getMovie()).production_companies, ctx.imageBaseUrl),
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
