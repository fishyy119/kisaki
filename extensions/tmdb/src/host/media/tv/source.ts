import type { TvScraperSlot, TvSessionResultMap } from '@kisaki3/extension-sdk'
import type { TmdbRequestContext, TmdbSeriesLoaders } from '../loaders'
import { toImageContext } from '../runtime'
import { buildTvCompanyFacts } from '../format/companies'
import { buildTvPersonFacts } from '../format/credits'
import {
  buildImageUrl,
  dedupeUrls,
  selectBackdropUrls,
  selectLogoUrls,
  selectPosterUrls
} from '../format/images'
import { buildTags } from '../format/tags'
import { buildTvEpisodes, buildTvSeasons } from './episodes'
import { buildTvInfo } from './info'
import type { TmdbSeriesRef } from './reference'

/**
 * Slots a TMDB show cannot answer.
 *
 * TMDB has no character entity, and a cast credit alone cannot name the
 * character it belongs to. It also never states a relation between two shows:
 * seasons are part of the entry here rather than neighbours of it.
 */
export type TmdbTvSlot = Exclude<TvScraperSlot, 'characters' | 'relatedEntries'>

export type TmdbTvSource = {
  [TSlot in TmdbTvSlot]: () => Promise<TvSessionResultMap[TSlot]>
}

export function createTvSource(
  ref: TmdbSeriesRef,
  loaders: TmdbSeriesLoaders,
  ctx: TmdbRequestContext
): TmdbTvSource {
  const images = toImageContext(ctx)

  return {
    info: () => buildTvInfo(ref, loaders),
    tags: async () => buildTags((await loaders.getSeries()).genres, await loaders.getKeywords()),
    seasons: () => buildTvSeasons(loaders),
    episodes: () => buildTvEpisodes(loaders),
    persons: async () => buildTvPersonFacts(await loaders.getCredits(), ctx.imageBaseUrl),
    companies: async () => {
      const series = await loaders.getSeries()
      return buildTvCompanyFacts(series.production_companies, series.networks, ctx.imageBaseUrl)
    },
    covers: async () => {
      const [series, artwork] = await Promise.all([loaders.getSeries(), loaders.getImages()])
      return dedupeUrls([
        ...selectPosterUrls(artwork, images),
        buildImageUrl(ctx.imageBaseUrl, series.poster_path)
      ])
    },
    backdrops: async () => selectBackdropUrls(await loaders.getImages(), images),
    logos: async () => selectLogoUrls(await loaders.getImages(), images)
  }
}
