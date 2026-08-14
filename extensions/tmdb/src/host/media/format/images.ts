import type { TmdbImage, TmdbImages } from '../../api/types'
import { TMDB_IMAGE_SIZE } from '../../utils/constants'

export interface TmdbImageContext {
  imageBaseUrl: string
  /** ISO-639-1 codes in preference order; `null` stands for untagged artwork. */
  preferredLanguages: readonly string[]
}

export function buildImageUrl(
  imageBaseUrl: string,
  filePath: string | null | undefined
): string | undefined {
  const path = filePath?.trim()
  return path
    ? `${imageBaseUrl}/${TMDB_IMAGE_SIZE}${path.startsWith('/') ? path : `/${path}`}`
    : undefined
}

/** Posters and logos read best in the user's language. */
export function selectPosterUrls(images: TmdbImages | undefined, ctx: TmdbImageContext): string[] {
  return selectImageUrls(images?.posters, ctx, ctx.preferredLanguages)
}

export function selectLogoUrls(images: TmdbImages | undefined, ctx: TmdbImageContext): string[] {
  return selectImageUrls(images?.logos, ctx, ctx.preferredLanguages)
}

/** Backdrops are wallpaper: untagged artwork carries no burnt-in title. */
export function selectBackdropUrls(
  images: TmdbImages | undefined,
  ctx: TmdbImageContext
): string[] {
  const withoutNull = ctx.preferredLanguages.filter((language) => language !== 'null')
  return selectImageUrls(images?.backdrops, ctx, ['null', ...withoutNull])
}

export function selectProfileUrls(images: TmdbImages | undefined, ctx: TmdbImageContext): string[] {
  return selectImageUrls(images?.profiles, ctx, [])
}

export function dedupeUrls(urls: readonly (string | undefined)[]): string[] {
  return [...new Set(urls.filter((url): url is string => url !== undefined))]
}

/**
 * Orders one image kind by language preference, keeping TMDB's own vote order
 * within a language. Variants outside the preference list are dropped when the
 * list is non-empty, because TMDB already filtered the response to it.
 */
function selectImageUrls(
  images: readonly TmdbImage[] | undefined,
  ctx: TmdbImageContext,
  languagePriority: readonly string[]
): string[] {
  if (!images || images.length === 0) {
    return []
  }

  const ranked = images.map((image, index) => ({
    url: buildImageUrl(ctx.imageBaseUrl, image.file_path),
    rank: rankLanguage(image.iso_639_1, languagePriority),
    index
  }))

  return ranked
    .filter(
      (entry): entry is { url: string; rank: number; index: number } => entry.url !== undefined
    )
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((entry) => entry.url)
}

function rankLanguage(
  language: string | null | undefined,
  languagePriority: readonly string[]
): number {
  if (languagePriority.length === 0) {
    return 0
  }

  const code = language ?? 'null'
  const rank = languagePriority.indexOf(code)
  return rank < 0 ? languagePriority.length : rank
}
